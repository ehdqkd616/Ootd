import { prisma, Prisma } from '@ootd/db';
import type { CreateOutfitRequest } from '@ootd/types';
import { randomUUID } from 'crypto';
import { Redis } from 'ioredis';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const memoryJobStore = new Map<string, string>();

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  enableOfflineQueue: false,
  maxRetriesPerRequest: 0,
  retryStrategy: () => null,
});
redis.on('error', () => { /* silently ignore */ });

export async function listOutfits(userId: string, page = 1, limit = 20) {
  const [data, total] = await Promise.all([
    prisma.outfit.findMany({
      where: { userId },
      include: { outfitItems: { include: { clothingItem: true } }, generatedImages: { take: 1 } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.outfit.count({ where: { userId } }),
  ]);
  return { data, total, page, limit, hasNext: page * limit < total };
}

export async function getOutfit(id: string, userId: string) {
  const outfit = await prisma.outfit.findFirst({
    where: { id, userId },
    include: { outfitItems: { include: { clothingItem: true } }, generatedImages: true },
  });
  if (!outfit) throw new Error('NOT_FOUND');
  return outfit;
}

export async function createOutfit(userId: string, body: CreateOutfitRequest) {
  return prisma.outfit.create({
    data: {
      userId,
      name: body.name,
      description: body.description,
      tags: body.tags ?? [],
      avatarId: body.avatarId,
      isPublic: body.isPublic ?? false,
      outfitItems: {
        create: body.items.map((item) => ({
          clothingItem: { connect: { id: item.clothingItemId } },
          layerOrder: item.layerOrder,
          positionData: (item.positionData ?? {}) as Prisma.InputJsonValue,
        })),
      },
    },
    include: { outfitItems: { include: { clothingItem: true } } },
  });
}

export async function updateOutfit(id: string, userId: string, body: { name?: string; description?: string; tags?: string[] }) {
  const outfit = await prisma.outfit.findFirst({ where: { id, userId } });
  if (!outfit) throw new Error('NOT_FOUND');
  return prisma.outfit.update({ where: { id }, data: body });
}

export async function deleteOutfit(id: string, userId: string) {
  const outfit = await prisma.outfit.findFirst({ where: { id, userId } });
  if (!outfit) throw new Error('NOT_FOUND');
  await prisma.outfit.delete({ where: { id } });
}

async function redisSet(key: string, ttl: number, value: string) {
  try { await redis.setex(key, ttl, value); } catch { memoryJobStore.set(key, value); }
}

async function redisGet(key: string): Promise<string | null> {
  try { return await redis.get(key); } catch { return memoryJobStore.get(key) ?? null; }
}

// ─── 이미지 다운로드 ──────────────────────────────────────────────────────────
async function fetchImageBase64(url: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(90_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      const mime = res.headers.get('content-type') ?? 'image/png';
      return `data:${mime};base64,${buffer.toString('base64')}`;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
    }
  }
  throw new Error('fetch failed');
}

// base64 data URI → Replicate 업로드용 Blob
async function urlToReplicateFile(dataUri: string): Promise<Blob> {
  const [header, b64] = dataUri.split(',');
  const mime = header.match(/data:(.*?);/)?.[1] ?? 'image/jpeg';
  const binary = Buffer.from(b64, 'base64');
  return new Blob([binary], { type: mime });
}

// ─── 가상 피팅 (IDM-VTON) - 여러 아이템을 순차적으로 입힘 ────────────────────
// 순서: outer/dress(1) → top(2) → bottom(3). shoes/accessory는 스킵.
const TRYON_ORDER: Record<string, number> = { dress: 1, outer: 2, top: 3, bottom: 4 };

interface GarmentItem {
  originalImageUrl: string | null;
  name: string | null;
  category: string | null;
}

async function virtualTryOnChained(
  avatarUrl: string,
  items: GarmentItem[],
): Promise<string | null> {
  const garments = items
    .filter((i) => i.originalImageUrl && i.category && TRYON_ORDER[i.category] !== undefined)
    .sort((a, b) => (TRYON_ORDER[a.category!] ?? 9) - (TRYON_ORDER[b.category!] ?? 9))
    .slice(0, 3); // 최대 3개 (비용 제한)

  if (garments.length === 0) return null;

  try {
    const Replicate = (await import('replicate')).default;
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_KEY });

    let currentHumanImg: string = avatarUrl;
    let lastResultUrl: string | null = null;

    for (const garment of garments) {
      // base64 data URI인 경우 Replicate FileOutput으로 업로드
      const humanImgInput = currentHumanImg.startsWith('data:')
        ? await urlToReplicateFile(currentHumanImg)
        : currentHumanImg;
      const garmImgInput = garment.originalImageUrl!.startsWith('data:')
        ? await urlToReplicateFile(garment.originalImageUrl!)
        : garment.originalImageUrl!;

      console.log(`[IDM-VTON] ${garment.category} (${garment.name}) 적용 중...`);
      const output = await replicate.run(
        'cuuupid/idm-vton:5c6712b51ff45af53bba0e88d4a5ec33fad0a85de32462e3d3cbcf51b53d5d37',
        {
          input: {
            human_img: humanImgInput,
            garm_img: garmImgInput,
            garment_des: garment.name ?? garment.category ?? 'clothing',
            is_checked: true,
            is_checked_crop: false,
            denoise_steps: 30,
            seed: Math.floor(Math.random() * 10000),
          },
        },
      ) as string[] | string;

      const resultUrl = Array.isArray(output) ? output[0] : output;
      if (!resultUrl) throw new Error(`${garment.category} 결과 URL 없음`);

      currentHumanImg = resultUrl;
      lastResultUrl = resultUrl;
      console.log(`[IDM-VTON] ${garment.category} 완료:`, resultUrl);
    }

    console.log('[IDM-VTON] 전체 피팅 완료');
    return await fetchImageBase64(lastResultUrl!, 2);
  } catch (err) {
    console.error('[IDM-VTON 실패]', err instanceof Error ? err.stack : err);
    return null;
  }
}

// ─── Pollinations 이미지 생성 (측면/후면 + 폴백) ─────────────────────────────
const POSE_LABELS: Record<string, string> = {
  front: 'front view, facing the camera directly',
  side: 'side profile view, facing left',
  back: 'back view, facing away from camera',
};

function buildPollinationsPrompt(
  outfitDescription: string,
  pose: string,
  bodyParams: Record<string, unknown> | null,
): string {
  const poseLabel = POSE_LABELS[pose] ?? 'front view';

  // 아바타 신체 정보를 프롬프트에 반영
  const physicalParts: string[] = [];
  if (bodyParams) {
    if (bodyParams.gender === 'female') physicalParts.push('female');
    else if (bodyParams.gender === 'male') physicalParts.push('male');
    if (bodyParams.height) physicalParts.push(`${bodyParams.height}cm tall`);
    if (bodyParams.bodyType === 'slim') physicalParts.push('slim build');
    else if (bodyParams.bodyType === 'plus') physicalParts.push('plus size build');
    if (bodyParams.skinTone === 'light') physicalParts.push('fair skin');
    else if (bodyParams.skinTone === 'dark') physicalParts.push('dark skin');
    else if (bodyParams.skinTone === 'medium') physicalParts.push('medium skin tone');
  }
  const personDesc = physicalParts.length > 0
    ? `a ${physicalParts.join(', ')} person`
    : 'a fashion model';

  return `Professional fashion editorial photo, full body shot, ${poseLabel}, ${personDesc} wearing ${outfitDescription}, plain white studio background, soft studio lighting, high quality, no text`;
}

async function generatePollinationsImage(
  outfitDescription: string,
  pose: string,
  bodyParams: Record<string, unknown> | null,
): Promise<string> {
  const prompt = buildPollinationsPrompt(outfitDescription, pose, bodyParams);
  const seed = Math.floor(Math.random() * 1_000_000);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=1024&nologo=true&seed=${seed}&model=flux`;
  return fetchImageBase64(url);
}

// ─── 메인: 이미지 생성 큐 ────────────────────────────────────────────────────
export async function enqueueImageGeneration(
  outfitId: string,
  avatarId: string | null,
  userId: string,
  poses: string[],
) {
  let resolvedAvatarId = avatarId;
  if (!resolvedAvatarId) {
    const avatar =
      (await prisma.avatar.findFirst({ where: { userId, isDefault: true } })) ??
      (await prisma.avatar.findFirst({ where: { userId } }));
    if (!avatar) throw new Error('NO_AVATAR');
    resolvedAvatarId = avatar.id;
  }

  const jobId = randomUUID();

  const [outfit, avatar] = await Promise.all([
    prisma.outfit.findFirst({
      where: { id: outfitId },
      include: { outfitItems: { include: { clothingItem: true } } },
    }),
    prisma.avatar.findFirst({ where: { id: resolvedAvatarId! } }),
  ]);
  if (!outfit) throw new Error('NOT_FOUND');

  const bodyParams = (avatar?.bodyParams ?? null) as Record<string, unknown> | null;

  // 의류 목록을 영어로 설명 (Pollinations + 가상피팅 설명 공용)
  const itemList = outfit.outfitItems
    .map((oi) => {
      const item = oi.clothingItem;
      const parts = [item.name ?? '의류', item.category ?? ''];
      if (item.colorTags?.length) parts.push(item.colorTags.join('/'));
      return parts.filter(Boolean).join(', ');
    })
    .join(' / ');

  const descMsg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    messages: [{
      role: 'user',
      content: `Describe this outfit in English concisely (under 35 words), focusing on specific colors and garment types. Outfit: ${itemList}`,
    }],
  });
  const outfitDescription = descMsg.content[0].type === 'text'
    ? descMsg.content[0].text.trim()
    : 'stylish outfit';

  // 포즈별 순차 생성
  for (const pose of poses) {
    let imageUrl: string;
    let model = 'pollinations-flux';

    if (pose === 'front' && avatar) {
      // 아이템 전체를 순서대로 입히는 체인 방식 (outer/top → bottom)
      const garments = outfit.outfitItems.map((oi) => oi.clothingItem);

      // 의류 구성에 따라 최적 아바타 사진 선택
      const hasUpper = garments.some((g) => ['top', 'outer', 'dress'].includes(g.category ?? ''));
      const hasLower = garments.some((g) => g.category === 'bottom');
      let avatarPhotoUrl: string;
      if (hasUpper && hasLower) {
        // 상하의 모두 있으면 전신 사진 사용
        avatarPhotoUrl = avatar.fullBodyUrl ?? avatar.sourceImageUrl;
      } else if (hasLower) {
        // 하의만 있으면 하반신/전신 사진
        avatarPhotoUrl = avatar.lowerBodyUrl ?? avatar.fullBodyUrl ?? avatar.sourceImageUrl;
      } else {
        // 상의/아우터만 있으면 상반신/전신 사진
        avatarPhotoUrl = avatar.upperBodyUrl ?? avatar.fullBodyUrl ?? avatar.sourceImageUrl;
      }

      const tryOnResult = await virtualTryOnChained(avatarPhotoUrl, garments);

      if (tryOnResult) {
        imageUrl = tryOnResult;
        model = 'idm-vton';
      } else {
        console.log('[IDM-VTON] 폴백 → Pollinations');
        imageUrl = await generatePollinationsImage(outfitDescription, pose, bodyParams);
      }
    } else {
      // 측면/후면: 아바타 신체 정보 기반 Pollinations 생성
      imageUrl = await generatePollinationsImage(outfitDescription, pose, bodyParams);
    }

    await prisma.generatedImage.create({
      data: { outfitId, avatarId: resolvedAvatarId!, pose, imageUrl, generationParams: { jobId, model } },
    });
  }

  return { jobId, status: 'completed' as const };
}

export async function getJob(jobId: string) {
  const raw = await redisGet(`job:${jobId}`);
  if (!raw) throw new Error('NOT_FOUND');
  return JSON.parse(raw) as { jobId: string; status: string; progress?: number };
}

export async function getGeneratedImages(outfitId: string, userId: string) {
  const outfit = await prisma.outfit.findFirst({ where: { id: outfitId, userId } });
  if (!outfit) throw new Error('NOT_FOUND');
  return prisma.generatedImage.findMany({ where: { outfitId }, orderBy: { createdAt: 'asc' } });
}

export async function deleteGeneratedImage(imageId: string, outfitId: string, userId: string) {
  const outfit = await prisma.outfit.findFirst({ where: { id: outfitId, userId } });
  if (!outfit) throw new Error('NOT_FOUND');
  await prisma.generatedImage.deleteMany({ where: { id: imageId, outfitId } });
}

export async function deleteAllGeneratedImages(outfitId: string, userId: string) {
  const outfit = await prisma.outfit.findFirst({ where: { id: outfitId, userId } });
  if (!outfit) throw new Error('NOT_FOUND');
  await prisma.generatedImage.deleteMany({ where: { outfitId } });
}
