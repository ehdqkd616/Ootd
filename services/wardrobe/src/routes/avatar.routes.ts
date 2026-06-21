import { Router, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { prisma, Prisma } from '@ootd/db';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware';

// 아바타 사진 압축: 최대 768x1024, JPEG 80% 품질 (20MB → ~200KB)
async function compressAvatarPhoto(buffer: Buffer): Promise<string> {
  const compressed = await sharp(buffer)
    .rotate() // EXIF orientation 자동 보정
    .resize(768, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  return `data:image/jpeg;base64,${compressed.toString('base64')}`;
}

export const avatarRouter = Router();
avatarRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  },
});

avatarRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const avatars = await prisma.avatar.findMany({
      where: { userId: req.userId! },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    res.json(avatars);
  } catch (err) {
    console.error('Avatar list error:', err);
    res.status(500).json({ message: '아바타 목록 조회 실패' });
  }
});

avatarRouter.post('/', upload.single('photo'), async (req: AuthRequest, res: Response) => {
  try {
    const sourceImageUrl = req.file
      ? await compressAvatarPhoto(req.file.buffer)
      : 'placeholder';

    const avatar = await prisma.avatar.create({
      data: {
        userId: req.userId!,
        name: (req.query.name as string) || null,
        sourceImageUrl,
        avatarBaseUrl: sourceImageUrl,
        isDefault: false,
      },
    });
    res.status(201).json(avatar);
  } catch (err) {
    console.error('Avatar create error:', err);
    res.status(500).json({ message: '아바타 생성 실패' });
  }
});

avatarRouter.post('/:id/default', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.avatar.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!existing) return res.status(404).json({ message: '아바타를 찾을 수 없습니다.' });

    await prisma.avatar.updateMany({ where: { userId: req.userId! }, data: { isDefault: false } });
    const avatar = await prisma.avatar.update({ where: { id: req.params.id }, data: { isDefault: true } });
    res.json(avatar);
  } catch (err) {
    console.error('Set default error:', err);
    res.status(500).json({ message: '기본 아바타 설정 실패' });
  }
});

avatarRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.avatar.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!existing) return res.status(404).json({ message: '아바타를 찾을 수 없습니다.' });

    const { name, bodyParams } = req.body as { name?: string; bodyParams?: Record<string, unknown> };
    const avatar = await prisma.avatar.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(bodyParams !== undefined && { bodyParams: bodyParams as Prisma.InputJsonValue }),
      },
    });
    res.json(avatar);
  } catch {
    res.status(500).json({ message: '아바타 수정 실패' });
  }
});

// 사진 유형별 업로드 (전신/상반신/하반신)
avatarRouter.post('/:id/photos', upload.single('photo'), async (req: AuthRequest, res: Response) => {
  try {
    const avatar = await prisma.avatar.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!avatar) return res.status(404).json({ message: '아바타를 찾을 수 없습니다.' });
    if (!req.file) return res.status(400).json({ message: '사진이 없습니다.' });

    const photoType = req.body.photoType as string;
    const validTypes = ['fullBody', 'upperBody', 'lowerBody'];
    if (!validTypes.includes(photoType)) {
      return res.status(400).json({ message: '유효하지 않은 사진 유형입니다.' });
    }

    const imageUrl = await compressAvatarPhoto(req.file.buffer);
    const fieldMap: Record<string, string> = {
      fullBody: 'fullBodyUrl',
      upperBody: 'upperBodyUrl',
      lowerBody: 'lowerBodyUrl',
    };

    const field = fieldMap[photoType] as 'fullBodyUrl' | 'upperBodyUrl' | 'lowerBodyUrl';
    const updated = await prisma.avatar.update({
      where: { id: req.params.id },
      data: { [field]: imageUrl },
    });
    res.json(updated);
  } catch (err) {
    console.error('Photo upload error:', err);
    res.status(500).json({ message: '사진 업로드 실패' });
  }
});

// 전신 아바타 생성 (InstantID: 얼굴 사진 → 전신 이미지)
avatarRouter.post('/:id/generate-fullbody', async (req: AuthRequest, res: Response) => {
  try {
    const avatar = await prisma.avatar.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!avatar) return res.status(404).json({ message: '아바타를 찾을 수 없습니다.' });
    if (!avatar.sourceImageUrl || avatar.sourceImageUrl === 'placeholder') {
      return res.status(400).json({ message: '아바타 사진이 없습니다.' });
    }

    const bp = (avatar.bodyParams ?? {}) as Record<string, unknown>;

    // 체형 프롬프트 구성
    const parts: string[] = [
      'full body photo, standing straight, neutral pose',
      'plain white studio background',
      'professional fashion photo, high quality, sharp focus',
    ];
    if (bp.gender === 'female') parts.push('woman');
    else if (bp.gender === 'male') parts.push('man');
    if (bp.height) parts.push(`${bp.height}cm tall`);
    if (bp.bodyType === 'slim') parts.push('slim build');
    else if (bp.bodyType === 'plus') parts.push('plus size build');
    else parts.push('average build');
    if (bp.skinTone === 'light') parts.push('fair skin');
    else if (bp.skinTone === 'dark') parts.push('dark skin');
    const prompt = parts.join(', ');

    console.log('[InstantID] 전신 아바타 생성 시작...');
    const Replicate = (await import('replicate')).default;
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_KEY });

    const output = await replicate.run(
      'zsxkib/instant-id:c98b2e7a196828d00955767813b81fc05c5c9b294c670c6d147d545fed4ceecf',
      {
        input: {
          image: avatar.sourceImageUrl,
          prompt,
          negative_prompt: 'low quality, blurry, bad anatomy, cropped, missing limbs, extra limbs, deformed, ugly, worst quality',
          width: 768,
          height: 1024,
          num_outputs: 1,
          ip_adapter_scale: 0.8,
          controlnet_conditioning_scale: 0.8,
        },
      },
    ) as string[] | string;

    const resultUrl = Array.isArray(output) ? output[0] : output;
    if (!resultUrl) throw new Error('결과 URL 없음');

    // base64로 변환 후 저장
    const imgRes = await fetch(resultUrl, { signal: AbortSignal.timeout(60_000) });
    if (!imgRes.ok) throw new Error(`이미지 다운로드 실패: ${imgRes.status}`);
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const mime = imgRes.headers.get('content-type') ?? 'image/png';
    const avatarBaseUrl = `data:${mime};base64,${buffer.toString('base64')}`;

    const updated = await prisma.avatar.update({
      where: { id: avatar.id },
      data: { avatarBaseUrl },
    });

    console.log('[InstantID] 전신 아바타 생성 완료');
    res.json(updated);
  } catch (err) {
    console.error('[InstantID] 실패:', err);
    res.status(500).json({ message: '전신 아바타 생성 실패', detail: err instanceof Error ? err.message : String(err) });
  }
});

avatarRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.avatar.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!existing) return res.status(404).json({ message: '아바타를 찾을 수 없습니다.' });

    await prisma.avatar.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(500).json({ message: '아바타 삭제 실패' });
  }
});
