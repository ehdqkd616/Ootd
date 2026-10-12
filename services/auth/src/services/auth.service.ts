import bcrypt from 'bcrypt';
import { prisma } from '@ootd/db';
import { signAccessToken, signRefreshToken } from './token.service';
import type { User } from '@ootd/types';

const BCRYPT_ROUNDS = 12;

function toUserDto(u: { id: string; username: string; name: string | null; profileImageUrl: string | null; isVerified: boolean; provider: string; createdAt: Date; updatedAt: Date }): User {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    profileImageUrl: u.profileImageUrl,
    isVerified: u.isVerified,
    provider: u.provider as User['provider'],
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

export async function register(username: string, password: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) throw new Error('USERNAME_EXISTS');

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: { username, passwordHash, name, provider: 'email' },
  });

  const accessToken = signAccessToken({ userId: user.id, username: user.username });
  const refreshToken = signRefreshToken({ userId: user.id, username: user.username });

  return { user: toUserDto(user), accessToken, refreshToken };
}

export async function login(username: string, password: string) {
  const user = await prisma.user.findUnique({ where: { username, deletedAt: null } });
  if (!user || !user.passwordHash) throw new Error('INVALID_CREDENTIALS');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error('INVALID_CREDENTIALS');

  const accessToken = signAccessToken({ userId: user.id, username: user.username });
  const refreshToken = signRefreshToken({ userId: user.id, username: user.username });

  return { user: toUserDto(user), accessToken, refreshToken };
}

export async function findById(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId, deletedAt: null } });
  if (!user) throw new Error('USER_NOT_FOUND');
  return toUserDto(user);
}
