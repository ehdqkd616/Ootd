import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, isBlacklisted } from '../services/token.service';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized', code: 'MISSING_TOKEN' });
  }

  const token = authHeader.slice(7);
  try {
    if (await isBlacklisted(token)) {
      return res.status(401).json({ message: 'Token revoked', code: 'TOKEN_REVOKED' });
    }
    const payload = verifyAccessToken(token);
    req.userId = payload.userId;
    req.userEmail = payload.email;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token', code: 'INVALID_TOKEN' });
  }
}
