import { Router, Response, NextFunction } from 'express';
import { prisma } from '@ootd/db';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware';
import { toUserDto } from '../services/auth.service';

export const adminRouter = Router();

// 관리자 여부는 토큰이 아니라 매번 DB에서 확인한다 — 권한을 바꾸면 즉시 반영되도록.
async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const me = await prisma.user.findUnique({ where: { id: req.userId!, deletedAt: null } });
  if (!me?.isAdmin || !me.isApproved) {
    return res.status(403).json({ message: '관리자만 접근할 수 있습니다.', code: 'FORBIDDEN' });
  }
  next();
}

adminRouter.use(requireAuth, requireAdmin);

async function findUser(id: string, res: Response) {
  const user = await prisma.user.findUnique({ where: { id } }).catch(() => null);
  if (!user) res.status(404).json({ message: '사용자를 찾을 수 없습니다.', code: 'NOT_FOUND' });
  return user;
}

adminRouter.get('/users', async (_req: AuthRequest, res: Response) => {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: [{ isApproved: 'asc' }, { createdAt: 'desc' }],
  });
  res.json(users.map(toUserDto));
});

adminRouter.post('/users/:id/approve', async (req: AuthRequest, res: Response) => {
  const user = await findUser(req.params.id, res);
  if (!user) return;
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { isApproved: true, approvedAt: new Date() },
  });
  res.json(toUserDto(updated));
});

adminRouter.post('/users/:id/unapprove', async (req: AuthRequest, res: Response) => {
  if (req.params.id === req.userId) {
    return res.status(400).json({ message: '본인 계정은 승인 취소할 수 없습니다.', code: 'VALIDATION_ERROR' });
  }
  const user = await findUser(req.params.id, res);
  if (!user) return;
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { isApproved: false, approvedAt: null },
  });
  res.json(toUserDto(updated));
});

adminRouter.delete('/users/:id', async (req: AuthRequest, res: Response) => {
  if (req.params.id === req.userId) {
    return res.status(400).json({ message: '본인 계정은 삭제할 수 없습니다.', code: 'VALIDATION_ERROR' });
  }
  const user = await findUser(req.params.id, res);
  if (!user) return;
  // 옷장·아바타·코디 등은 onDelete: Cascade로 함께 삭제된다.
  await prisma.user.delete({ where: { id: user.id } });
  res.json({ deleted: user.id });
});
