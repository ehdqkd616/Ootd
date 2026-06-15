import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import * as authService from '../services/auth.service';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  blacklistToken,
} from '../services/token.service';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware';

export const authRouter = Router();

const authLimiter = rateLimit({ windowMs: 60_000, max: 10 });

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

authRouter.post('/register', authLimiter, async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: '유효하지 않은 입력값', errors: parsed.error.flatten() });

  try {
    const { user, accessToken, refreshToken } = await authService.register(
      parsed.data.email,
      parsed.data.password,
      parsed.data.name,
    );
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.status(201).json({ user, accessToken });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'EMAIL_EXISTS') {
      return res.status(409).json({ message: '이미 사용 중인 이메일입니다.', code: 'EMAIL_EXISTS' });
    }
    res.status(500).json({ message: '서버 오류', code: 'INTERNAL_ERROR' });
  }
});

authRouter.post('/login', authLimiter, async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: '유효하지 않은 입력값' });

  try {
    const { user, accessToken, refreshToken } = await authService.login(
      parsed.data.email,
      parsed.data.password,
    );
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.json({ user, accessToken });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.', code: 'INVALID_CREDENTIALS' });
    }
    res.status(500).json({ message: '서버 오류', code: 'INTERNAL_ERROR' });
  }
});

authRouter.post('/logout', requireAuth, async (req: AuthRequest, res: Response) => {
  const token = req.headers.authorization?.slice(7);
  if (token) await blacklistToken(token, 15 * 60);
  res.clearCookie('refreshToken');
  res.json({ success: true });
});

authRouter.post('/refresh', async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) return res.status(401).json({ message: 'No refresh token', code: 'MISSING_TOKEN' });

  try {
    const payload = verifyRefreshToken(refreshToken);
    const user = await authService.findById(payload.userId);
    const newAccessToken = signAccessToken({ userId: user.id, email: user.email });
    const newRefreshToken = signRefreshToken({ userId: user.id, email: user.email });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.json({ user, accessToken: newAccessToken });
  } catch {
    res.status(401).json({ message: 'Invalid refresh token', code: 'INVALID_TOKEN' });
  }
});

authRouter.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await authService.findById(req.userId!);
    res.json(user);
  } catch {
    res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
  }
});
