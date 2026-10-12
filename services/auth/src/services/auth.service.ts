import bcrypt from 'bcrypt';
import { prisma } from '@ootd/db';
import type { User as DbUser } from '@ootd/db';
import { signAccessToken, signRefreshToken } from './token.service';
import type { User } from '@ootd/types';

const BCRYPT_ROUNDS = 12;

export function toUserDto(u: DbUser): User {
  return {
    id: u.id,
    loginId: u.loginId,
    email: u.email,
    name: u.name,
    signupNote: u.signupNote,
    profileImageUrl: u.profileImageUrl,
    isVerified: u.isVerified,
    provider: u.provider as User['provider'],
    isApproved: u.isApproved,
    isAdmin: u.isAdmin,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

function issueTokens(u: DbUser) {
  const payload = { userId: u.id, loginId: u.loginId };
  return { accessToken: signAccessToken(payload), refreshToken: signRefreshToken(payload) };
}

/** 가입만 해두고 토큰은 발급하지 않는다 — 관리자 승인 전에는 로그인할 수 없다. */
export async function register(loginId: string, password: string, name: string, signupNote?: string | null) {
  const existing = await prisma.user.findUnique({ where: { loginId } });
  if (existing) throw new Error('LOGIN_ID_EXISTS');

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: { loginId, passwordHash, name, signupNote: signupNote || null },
  });

  return { user: toUserDto(user) };
}

export async function login(loginId: string, password: string) {
  const user = await prisma.user.findUnique({ where: { loginId, deletedAt: null } });
  if (!user || !user.passwordHash) throw new Error('INVALID_CREDENTIALS');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error('INVALID_CREDENTIALS');
  if (!user.isApproved) throw new Error('PENDING_APPROVAL');

  return { user: toUserDto(user), ...issueTokens(user) };
}

/** refresh 때마다 승인 상태를 다시 본다 — 승인 취소·삭제된 계정은 여기서 끊긴다. */
export async function refresh(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId, deletedAt: null } });
  if (!user) throw new Error('USER_NOT_FOUND');
  if (!user.isApproved) throw new Error('PENDING_APPROVAL');
  return { user: toUserDto(user), ...issueTokens(user) };
}

export async function findById(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId, deletedAt: null } });
  if (!user) throw new Error('USER_NOT_FOUND');
  return toUserDto(user);
}

/**
 * 공통 관리자 계정 admin을 .env의 ADMIN_PASSWORD로 맞춘다 (모든 프로젝트 공통).
 * 없으면 만들고, 있으면 관리자·승인 상태와 비밀번호를 .env 값으로 되돌린다 — 비밀번호는 .env가 기준.
 */
export const ADMIN_LOGIN_ID = 'admin';

export async function bootstrapAdmin() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return;

  const existing = await prisma.user.findUnique({ where: { loginId: ADMIN_LOGIN_ID } });
  if (existing) {
    const samePassword = existing.passwordHash ? await bcrypt.compare(password, existing.passwordHash) : false;
    if (samePassword && existing.isAdmin && existing.isApproved && !existing.deletedAt) return;
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        isAdmin: true,
        isApproved: true,
        approvedAt: existing.approvedAt ?? new Date(),
        deletedAt: null,
        ...(samePassword ? {} : { passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) }),
      },
    });
    console.log(`Admin account "${ADMIN_LOGIN_ID}" synced`);
    return;
  }

  await prisma.user.create({
    data: {
      loginId: ADMIN_LOGIN_ID,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      name: '관리자',
      isAdmin: true,
      isApproved: true,
      approvedAt: new Date(),
    },
  });
  console.log(`Admin account "${ADMIN_LOGIN_ID}" created`);
}
