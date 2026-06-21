import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware';
import * as outfitService from '../services/outfit.service';

export const outfitRouter = Router();
outfitRouter.use(requireAuth);

const createOutfitSchema = z.object({
  name: z.string().max(200).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  avatarId: z.string().uuid().optional(),
  isPublic: z.boolean().optional(),
  items: z.array(z.object({
    clothingItemId: z.string().uuid(),
    layerOrder: z.number().int(),
    positionData: z.record(z.unknown()).optional(),
  })),
});

outfitRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Math.min(Number(req.query.limit ?? 20), 50);
    const result = await outfitService.listOutfits(req.userId!, page, limit);
    res.json(result);
  } catch (err) {
    console.error('[outfits GET /]', err);
    res.status(500).json({ message: '코디 목록 조회 실패' });
  }
});

outfitRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const outfit = await outfitService.getOutfit(req.params.id, req.userId!);
    res.json(outfit);
  } catch {
    res.status(404).json({ message: '코디를 찾을 수 없습니다.' });
  }
});

outfitRouter.post('/', async (req: AuthRequest, res: Response) => {
  const parsed = createOutfitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: '유효하지 않은 입력값', errors: parsed.error.flatten() });

  try {
    const outfit = await outfitService.createOutfit(req.userId!, parsed.data as Parameters<typeof outfitService.createOutfit>[1]);
    res.status(201).json(outfit);
  } catch {
    res.status(500).json({ message: '코디 저장 실패' });
  }
});

outfitRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, tags } = req.body as { name?: string; description?: string; tags?: string[] };
    const outfit = await outfitService.updateOutfit(req.params.id, req.userId!, { name, description, tags });
    res.json(outfit);
  } catch {
    res.status(404).json({ message: '코디를 찾을 수 없습니다.' });
  }
});

outfitRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await outfitService.deleteOutfit(req.params.id, req.userId!);
    res.status(204).send();
  } catch {
    res.status(404).json({ message: '코디를 찾을 수 없습니다.' });
  }
});

outfitRouter.post('/:id/generate', async (req: AuthRequest, res: Response) => {
  try {
    const outfit = await outfitService.getOutfit(req.params.id, req.userId!);
    const poses = (req.body.poses as string[] | undefined) ?? ['front', 'side', 'back'];
    const job = await outfitService.enqueueImageGeneration(outfit.id, outfit.avatarId, req.userId!, poses);
    res.status(202).json(job);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[generate] error:', msg);
    if (msg === 'NO_AVATAR') return res.status(400).json({ message: '아바타가 없습니다. 아바타 페이지에서 먼저 아바타를 추가해주세요.' });
    res.status(500).json({ message: 'AI 이미지 생성 요청 실패', detail: msg });
  }
});

outfitRouter.get('/:id/images', async (req: AuthRequest, res: Response) => {
  try {
    const images = await outfitService.getGeneratedImages(req.params.id, req.userId!);
    res.json(images);
  } catch {
    res.status(404).json({ message: '코디를 찾을 수 없습니다.' });
  }
});

outfitRouter.delete('/:id/images/:imageId', async (req: AuthRequest, res: Response) => {
  try {
    await outfitService.deleteGeneratedImage(req.params.imageId, req.params.id, req.userId!);
    res.status(204).send();
  } catch {
    res.status(404).json({ message: '이미지를 찾을 수 없습니다.' });
  }
});

outfitRouter.delete('/:id/images', async (req: AuthRequest, res: Response) => {
  try {
    await outfitService.deleteAllGeneratedImages(req.params.id, req.userId!);
    res.status(204).send();
  } catch {
    res.status(404).json({ message: '코디를 찾을 수 없습니다.' });
  }
});

outfitRouter.get('/jobs/:jobId', async (req: AuthRequest, res: Response) => {
  try {
    const job = await outfitService.getJob(req.params.jobId);
    res.json(job);
  } catch {
    res.status(404).json({ message: '작업을 찾을 수 없습니다.' });
  }
});
