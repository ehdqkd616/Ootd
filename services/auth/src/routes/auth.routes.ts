import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import * as authService from '../services/auth.service';
import { verifyRefreshToken, blacklistToken } from '../services/token.service';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware';
import { sendSignupNotification } from '../services/mailer.service';

export const authRouter = Router();

const authLimiter = rateLimit({ windowMs: 60_000, max: 10 });

// 아이디: 영문·숫자·_·- 3~32자 (모든 프로젝트 공통 규칙). 대소문자는 구분하지 않도록 소문자로 저장
const LOGIN_ID = /^[a-z0-9_-]{3,32}$/;

const registerSchema = z.object({
  loginId: z
    .string()
    .trim()
    .toLowerCase()
    .regex(LOGIN_ID, '아이디는 영문, 숫자, _, - 조합 3~32자여야 합니다.'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.').max(72),
  name: z.string().trim().min(1, '이름을 입력하세요.').max(100),
});

const loginSchema = z.object({
  loginId: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});

const REFRESH_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

authRouter.post('/register', authLimiter, async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? '유효하지 않은 입력값';
    return res.status(400).json({ message, code: 'VALIDATION_ERROR', errors: parsed.error.flatten() });
  }

  try {
    const { user } = await authService.register(parsed.data.loginId, parsed.data.password, parsed.data.name);
    // 관리자 승인 전에는 로그인할 수 없으므로 토큰·쿠키를 발급하지 않는다.
    res.status(201).json({ user, pendingApproval: true });
    // 알림 메일은 응답과 분리해서 보낸다 — SMTP가 느리거나 실패해도 가입은 그대로 성공.
    void sendSignupNotification({ loginId: user.loginId, name: user.name, createdAt: new Date(user.createdAt) });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'LOGIN_ID_EXISTS') {
      return res.status(409).json({ message: '이미 사용 중인 아이디입니다.', code: 'LOGIN_ID_EXISTS' });
    }
    res.status(500).json({ message: '서버 오류', code: 'INTERNAL_ERROR' });
  }
});

authRouter.post('/login', authLimiter, async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: '아이디와 비밀번호를 입력하세요.', code: 'VALIDATION_ERROR' });

  try {
    const { user, accessToken, refreshToken } = await authService.login(
      parsed.data.loginId,
      parsed.data.password,
    );
    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE);
    res.json({ user, accessToken });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.', code: 'INVALID_CREDENTIALS' });
    }
    if (err instanceof Error && err.message === 'PENDING_APPROVAL') {
      return res.status(403).json({ message: '관리자 승인 대기 중입니다. 승인되면 로그인할 수 있어요.', code: 'PENDING_APPROVAL' });
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
    const { user, accessToken, refreshToken: newRefreshToken } = await authService.refresh(payload.userId);
    res.cookie('refreshToken', newRefreshToken, REFRESH_COOKIE);
    res.json({ user, accessToken });
  } catch {
    res.clearCookie('refreshToken');
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
