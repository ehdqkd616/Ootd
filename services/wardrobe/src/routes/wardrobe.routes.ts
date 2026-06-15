import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware';
import * as wardrobeService from '../services/wardrobe.service';

export const wardrobeRouter = Router();

wardrobeRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype));
  },
});

const uploadLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20 });

wardrobeRouter.get('/', async (req: AuthRequest, res: Response) => {
  const filters = {
    category: req.query.category as string | undefined,
    search: req.query.search as string | undefined,
    isArchived: req.query.isArchived === 'true',
    page: Number(req.query.page ?? 1),
    limit: Math.min(Number(req.query.limit ?? 20), 100),
  };
  const result = await wardrobeService.listItems(req.userId!, filters);
  res.json(result);
});

wardrobeRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const item = await wardrobeService.getItem(req.params.id, req.userId!);
    res.json(item);
  } catch {
    res.status(404).json({ message: '아이템을 찾을 수 없습니다.' });
  }
});

wardrobeRouter.post('/', uploadLimiter, upload.single('image'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ message: '이미지가 필요합니다.' });
  try {
    const item = await wardrobeService.createFromUpload(
      req.userId!,
      req.file.buffer,
      req.file.mimetype,
      req.body,
    );
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ message: '업로드 실패' });
  }
});

wardrobeRouter.post('/import-url', uploadLimiter, async (req: AuthRequest, res: Response) => {
  const schema = z.object({ sourceUrl: z.string().url() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'URL이 유효하지 않습니다.' });

  try {
    const item = await wardrobeService.createFromUrl(req.userId!, parsed.data.sourceUrl, req.body);
    res.status(201).json(item);
  } catch {
    res.status(500).json({ message: 'URL 가져오기 실패' });
  }
});

wardrobeRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const item = await wardrobeService.updateItem(req.params.id, req.userId!, req.body);
    res.json(item);
  } catch {
    res.status(404).json({ message: '아이템을 찾을 수 없습니다.' });
  }
});

wardrobeRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await wardrobeService.deleteItem(req.params.id, req.userId!);
    res.status(204).send();
  } catch {
    res.status(404).json({ message: '아이템을 찾을 수 없습니다.' });
  }
});

wardrobeRouter.post('/:id/archive', async (req: AuthRequest, res: Response) => {
  try {
    const item = await wardrobeService.archiveItem(req.params.id, req.userId!);
    res.json(item);
  } catch {
    res.status(404).json({ message: '아이템을 찾을 수 없습니다.' });
  }
});
