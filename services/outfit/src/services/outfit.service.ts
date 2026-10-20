import { prisma, Prisma } from '@ootd/db';
import type { CreateOutfitRequest } from '@ootd/types';
import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import { Redis } from 'ioredis';

const memoryJobStore = new Map<string, string>();

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6381', {
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

// ─── 착장 샷 생성 (Seedream 4.5, 다중 참고 이미지) ─────────────────────────────
// 아바타 사진(얼굴·체형) + 옷 사진들을 참고 이미지로 넘겨 "이 사람이 이 옷들을 입은 전신 사진"을 새로 만든다.
// IDM-VTON(사진 속 옷만 교체)은 증명사진처럼 상반신만 있는 아바타에 바지·신발을 입힐 수 없고,
// 텍스트만 보고 그리는 Pollinations는 본인·실제 옷과 무관한 이미지가 나와서 둘 다 쓰지 않는다.
const OUTFIT_SHOT_MODEL = 'bytedance/seedream-4.5';
const MAX_GARMENTS = 6;

// 참고 이미지 순서 = 프롬프트에서 언급하는 순서 (겉에서 안으로, 위에서 아래로)
const GARMENT_ORDER: Record<string, number> = { outer: 1, dress: 2, top: 3, bottom: 4, shoes: 5, accessory: 6, etc: 7 };
const GARMENT_LABEL: Record<string, string> = {
  outer: 'outerwear', dress: 'dress', top: 'top', bottom: 'bottoms', shoes: 'shoes', accessory: 'accessory', etc: 'item',
};

// 웹(@ootd/types)과 같은 값 — 서비스는 컴파일된 JS로도 돌기 때문에 .ts 패키지 런타임 값을 가져오지 않는다
export const CUSTOM_POSE_ID = 'custom';
export const MAX_POSES_PER_REQUEST = 4;
export const MAX_CUSTOM_POSE_LENGTH = 300;

// 포즈 템플릿 id → 이미지 모델용 포즈 묘사 (화면에 보이는 이름·설명은 @ootd/types의 POSE_TEMPLATES)
export const POSE_PROMPTS: Record<string, string> = {
  front: 'natural relaxed standing pose, front view, facing the camera, arms resting at the sides',
  three_quarter: 'standing in a three-quarter view, body angled about 45 degrees to the camera, face turned toward the camera, weight on one leg',
  side: 'standing in a side profile view, body turned 90 degrees to the left, arms relaxed',
  back: 'standing in a back view, facing away from the camera, showing the back of the outfit',
  over_shoulder: 'standing with the back mostly to the camera, looking back over one shoulder toward the camera',
  walking: 'mid-stride walking toward the camera, one foot stepping forward, arms swinging naturally, candid street-style snap',
  hands_in_pockets: 'standing casually facing the camera with both hands in the pockets, relaxed shoulders',
  hand_on_hip: 'confident editorial pose facing the camera, one hand on the hip, weight shifted to one leg',
  arms_crossed: 'standing facing the camera with arms crossed over the chest, confident expression',
  leaning_wall: 'leaning one shoulder casually against a plain light wall, legs loosely crossed at the ankles, relaxed posture',
  sitting: 'sitting on a simple minimal stool with legs crossed, upright posture, facing the camera',
  crouching: 'crouching down in a low squat, forearms resting on the knees, street fashion editorial pose, facing the camera',
};

interface GarmentItem {
  originalImageUrl: string | null;
  name: string | null;
  category: string | null;
  colorTags: string[];
}

function describePerson(bodyParams: Record<string, unknown> | null) {
  const parts: string[] = [];
  if (bodyParams?.height) parts.push(`${bodyParams.height}cm tall`);
  if (bodyParams?.bodyType === 'slim') parts.push('slim build');
  else if (bodyParams?.bodyType === 'plus') parts.push('plus-size build');
  else if (bodyParams?.bodyType) parts.push('average build');
  const who = bodyParams?.gender === 'female' ? 'woman' : bodyParams?.gender === 'male' ? 'man' : 'person';
  return parts.length ? `a ${parts.join(', ')} ${who}` : `a ${who}`;
}

// ─── 직접 입력한 포즈 → 이미지 모델용 영어 묘사 ─────────────────────────────────
// 사용자는 한국어로 적는 경우가 대부분이라 Claude로 짧은 영어 포즈 묘사로 바꾼다.
// 옷을 바꾸라는 요청은 무시하게 한다 (착장은 옷장의 옷으로 고정). 실패하면 원문을 그대로 쓴다.
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const POSE_TRANSLATE_TOOL: Anthropic.Tool = {
  name: 'pose_description',
  description: '이미지 생성 모델에 넣을 영어 포즈 묘사를 반환한다.',
  input_schema: {
    type: 'object',
    properties: {
      pose: {
        type: 'string',
        description:
          'One concise English phrase (max ~40 words) describing body pose, gesture, facial expression, camera angle and, if requested, the background/setting. Never mention clothing.',
      },
    },
    required: ['pose'],
  },
};

async function translateCustomPose(text: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return text;
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system:
        '사용자가 패션 착장 사진에서 원하는 포즈를 설명합니다. 이를 이미지 생성 모델용 영어 포즈 묘사로 바꾸세요. ' +
        '자세·손동작·표정·카메라 각도·배경만 묘사하고, 옷이나 액세서리를 바꾸거나 추가하라는 요청, 노출·선정적인 요청은 무시하세요.',
      tools: [POSE_TRANSLATE_TOOL],
      tool_choice: { type: 'tool', name: POSE_TRANSLATE_TOOL.name },
      messages: [{ role: 'user', content: text }],
    });
    const toolUse = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    const pose = (toolUse?.input as { pose?: unknown } | undefined)?.pose;
    return typeof pose === 'string' && pose.trim() ? pose.trim() : text;
  } catch (err) {
    console.error('[outfit-shot] 포즈 번역 실패, 원문 사용:', err instanceof Error ? err.message : err);
    return text;
  }
}

function buildOutfitShotPrompt(garments: GarmentItem[], posePrompt: string, bodyParams: Record<string, unknown> | null) {
  const wearing = garments
    .map((g, i) => {
      const label = GARMENT_LABEL[g.category ?? 'etc'] ?? 'item';
      const desc = [g.name, g.colorTags.length ? `(${g.colorTags.join('/')})` : ''].filter(Boolean).join(' ');
      return `the ${label}${desc ? ` "${desc}"` : ''} from image ${i + 2}`;
    })
    .join(', ');
  return (
    `Photorealistic full-body fashion photo of the person in image 1. Keep their face, hairstyle and identity exactly the same. ` +
    `They are ${describePerson(bodyParams)}. They are wearing exactly these garments: ${wearing}. ` +
    `Reproduce each garment faithfully (color, print, logo, fit, fabric, details). Do not add any other clothing or accessories. ` +
    `Pose: ${posePrompt}. Entire body from head to feet visible in frame, ` +
    `clean light seamless studio background unless the pose describes another setting, soft natural lighting, sharp focus, high detail, editorial lookbook style.`
  );
}

async function generateOutfitShot(
  personImageUrl: string,
  items: GarmentItem[],
  pose: string,
  posePrompt: string,
  bodyParams: Record<string, unknown> | null,
): Promise<string> {
  const garments = items
    .filter((i) => i.originalImageUrl)
    .sort((a, b) => (GARMENT_ORDER[a.category ?? 'etc'] ?? 9) - (GARMENT_ORDER[b.category ?? 'etc'] ?? 9))
    .slice(0, MAX_GARMENTS);
  if (garments.length === 0) throw new Error('NO_TRYON_GARMENT');

  const toInput = (url: string) => (url.startsWith('data:') ? urlToReplicateFile(url) : Promise.resolve(url));
  const imageInput = await Promise.all([personImageUrl, ...garments.map((g) => g.originalImageUrl!)].map(toInput));

  const Replicate = (await import('replicate')).default;
  // replicate 1.x는 기본으로 결과를 FileOutput(스트림)으로 준다 — 다운로드에 URL 문자열이 필요하다
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_KEY, useFileOutput: false });

  console.log(`[outfit-shot] ${pose} 생성 중 (옷 ${garments.length}개)...`);
  const t0 = Date.now();
  const output = (await replicate.run(OUTFIT_SHOT_MODEL, {
    input: {
      prompt: buildOutfitShotPrompt(garments, posePrompt, bodyParams),
      image_input: imageInput,
      aspect_ratio: '3:4',
      size: '2K',
      max_images: 1,
    },
  })) as string[] | string;
  const url = Array.isArray(output) ? output[0] : output;
  if (!url) throw new Error('결과 URL 없음');
  console.log(`[outfit-shot] ${pose} 완료 (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  return fetchImageBase64(url, 2);
}

// ─── 메인: 이미지 생성 큐 ────────────────────────────────────────────────────
export async function enqueueImageGeneration(
  outfitId: string,
  avatarId: string | null,
  userId: string,
  poses: string[],
  customPose?: string,
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
  if (!avatar) throw new Error('NO_AVATAR');

  const bodyParams = (avatar.bodyParams ?? null) as Record<string, unknown> | null;
  const garments = outfit.outfitItems.map((oi) => oi.clothingItem);
  // 얼굴·체형 참고용 — 전신 사진이 있으면 그걸, 없으면 원본 사진
  const personImageUrl = avatar.fullBodyUrl ?? avatar.sourceImageUrl;

  const requests: { pose: string; posePrompt: string; customText?: string }[] = [...new Set(poses)]
    .filter((p) => Object.hasOwn(POSE_PROMPTS, p))
    .map((p) => ({ pose: p, posePrompt: POSE_PROMPTS[p] }));
  if (customPose) {
    requests.push({ pose: CUSTOM_POSE_ID, posePrompt: await translateCustomPose(customPose), customText: customPose });
  }
  if (requests.length === 0) throw new Error('NO_POSE');

  // 포즈별 순차 생성 (Replicate 잔액이 적으면 동시 요청이 1개로 제한된다)
  for (const { pose, posePrompt, customText } of requests) {
    let imageUrl: string;
    try {
      imageUrl = await generateOutfitShot(personImageUrl, garments, pose, posePrompt, bodyParams);
    } catch (err) {
      if (err instanceof Error && err.message === 'NO_TRYON_GARMENT') throw err;
      console.error('[outfit-shot 실패]', err instanceof Error ? err.stack : err);
      throw new Error('TRYON_FAILED');
    }

    await prisma.generatedImage.create({
      data: {
        outfitId,
        avatarId: resolvedAvatarId!,
        pose,
        imageUrl,
        generationParams: { jobId, model: OUTFIT_SHOT_MODEL, posePrompt, ...(customText ? { customPose: customText } : {}) },
      },
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
