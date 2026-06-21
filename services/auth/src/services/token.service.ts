import jwt from 'jsonwebtoken';
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN ?? '30d';

export interface TokenPayload {
  userId: string;
  email: string;
}

export function signAccessToken(payload: TokenPayload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES as never });
}

export function signRefreshToken(payload: TokenPayload) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES as never });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, ACCESS_SECRET) as TokenPayload & { iat: number; exp: number };
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, REFRESH_SECRET) as TokenPayload & { iat: number; exp: number };
}

export async function blacklistToken(token: string, expiresInSeconds: number) {
  await redis.setex(`blacklist:${token}`, expiresInSeconds, '1');
}

export async function isBlacklisted(token: string) {
  return !!(await redis.get(`blacklist:${token}`));
}
