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
  // 다른 사람의 옷·아바타를 코디에 넣지 못하게 소유자를 확인한다
  const itemIds = [...new Set(body.items.map((i) => i.clothingItemId))];
  const ownedItems = await prisma.clothingItem.count({ where: { id: { in: itemIds }, userId } });
  if (ownedItems !== itemIds.length) throw new Error('INVALID_ITEMS');
  if (body.avatarId && !(await prisma.avatar.findFirst({ where: { id: body.avatarId, userId } }))) {
    throw new Error('NO_AVATAR');
  }

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
// 전신 컷에서는 얼굴이 작아 생김새가 뭉개지고 달라진다 — 생성 후 아바타 사진의 얼굴로 교체해 닮음을 되살린다
// (얼굴 복원 모델까지 거치면 보정 앱처럼 꾸민 얼굴이 돼서 교체만 한다)
const FACE_SWAP_MODEL = 'cdingram/face-swap:d1d6ea8c8be89d664a07a457526f7128109dee7030fdac424788d762c71ed111';
// 얼굴이 거의 안 보이는 포즈는 교체하지 않는다
const NO_FACE_SWAP_POSES = new Set(['back']);
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
// 대칭으로 팔을 붙이고 선 마네킹 자세가 나오지 않도록 무게중심·손·시선을 구체적으로 적는다
export const POSE_PROMPTS: Record<string, string> = {
  front: 'standing relaxed and facing the camera, weight shifted onto one leg, one arm hanging loosely and the other hand lightly touching the hem, shoulders slightly uneven, a soft natural smile',
  three_quarter: 'standing in a three-quarter view, body angled about 45 degrees away from the camera, face turned back toward the camera, weight on the back leg, front knee softly bent',
  side: 'standing in a side profile view, body turned 90 degrees, mid-step with one heel slightly lifted, arms relaxed, looking ahead',
  back: 'standing in a back view, facing away from the camera, head turned slightly to one side, weight on one leg, showing the back of the outfit',
  over_shoulder: 'walking away from the camera and glancing back over one shoulder toward the camera with a relaxed expression',
  walking: 'caught mid-stride walking toward the camera, one foot forward, arms swinging naturally, slight motion in the fabric, candid street snap',
  hands_in_pockets: 'standing casually with both hands loosely in the pockets, weight on one leg, shoulders relaxed, head tilted slightly',
  hand_on_hip: 'relaxed editorial pose, one hand resting on the hip, weight shifted to one leg, the other arm loose, chin slightly down',
  arms_crossed: 'standing with arms loosely crossed, leaning back slightly, weight on one leg, calm confident expression',
  leaning_wall: 'leaning one shoulder against a wall, ankles loosely crossed, one hand in a pocket, relaxed posture, looking slightly off camera',
  sitting: 'sitting on a simple stool, one leg crossed over the other, leaning forward slightly with forearms resting on the thigh, natural expression',
  crouching: 'crouching in a low squat, forearms resting on the knees, hands loosely clasped, looking at the camera, street fashion editorial',
  stairs_sitting: 'sitting casually on a step, knees up, one forearm resting on a knee, the other hand on the step, relaxed and looking at the camera',
  coffee: 'standing relaxed holding a takeaway coffee cup in one hand near the chest, the other hand in a pocket, weight on one leg, gentle smile',
  phone_walk: 'walking slowly while looking down at a smartphone held in one hand, the other arm relaxed, candid everyday moment',
  looking_away: 'standing in a relaxed pose, body slightly angled, gazing into the distance away from the camera, thoughtful calm expression',
  adjusting: 'caught in the moment of adjusting a sleeve cuff or collar with both hands, looking down at the hands, natural candid moment',
  laughing: 'candid moment of genuine laughter, head tilted back slightly, one hand raised loosely toward the face, relaxed body language',
};

// 배경 템플릿 id → 이미지 모델용 장소·조명 묘사 (화면에 보이는 이름은 @ootd/types의 BACKGROUND_TEMPLATES)
export const BACKGROUND_PROMPTS: Record<string, string> = {
  studio: 'a light grey seamless paper studio backdrop with soft large-window style key light and a gentle floor shadow',
  warm_studio: 'a warm beige paper backdrop in a daylight studio, soft directional window light from the side, subtle warm tones',
  city_street: 'a modern city street in Seoul with buildings, a crosswalk and blurred pedestrians, overcast daylight',
  alley: 'a quiet Seoul residential alley with low brick houses, potted plants and a concrete wall, soft afternoon sun',
  cafe: 'inside a cozy wooden cafe with warm pendant lights, plants and a large window letting in daylight',
  park: 'a tree-lined park path with dappled sunlight through green leaves, soft bokeh background',
  riverside: 'the Han River walking path in Seoul with the river and a bridge in the background, golden late-afternoon light',
  beach: 'a sandy beach with gentle waves and a wide horizon, bright soft sea light, light breeze',
  gallery: 'a minimal art gallery with white walls, framed artworks and polished concrete floor, soft even museum lighting',
  subway: 'a clean subway station platform with tiled walls and cool overhead lighting, a train blurred in the background',
  rooftop_sunset: 'a city rooftop at sunset with the skyline behind, warm golden backlight and soft rim light',
  bookstore: 'a cozy bookstore with tall wooden bookshelves full of books, warm ambient lighting',
  autumn_leaves: 'an autumn avenue lined with ginkgo and maple trees, fallen yellow and red leaves on the ground, soft golden light',
  snowy_street: 'a quiet snowy street in winter with snow on the ground and rooftops, soft diffused cool daylight, light snowfall',
};
export const DEFAULT_BACKGROUND_ID = 'studio';
export const CUSTOM_BACKGROUND_ID = 'custom';
export const MAX_CUSTOM_BACKGROUND_LENGTH = 300;

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

const TRANSLATE_TOOL: Anthropic.Tool = {
  name: 'image_prompt',
  description: '이미지 생성 모델에 넣을 영어 묘사를 반환한다.',
  input_schema: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'One concise English phrase (max ~40 words). Never mention clothing.',
      },
    },
    required: ['text'],
  },
};

const TRANSLATE_SYSTEM: Record<'pose' | 'background', string> = {
  pose:
    '사용자가 패션 착장 사진에서 원하는 포즈를 설명합니다. 이를 이미지 생성 모델용 영어 포즈 묘사로 바꾸세요. ' +
    '자세·무게중심·손동작·시선·표정·카메라 각도를 자연스럽게 묘사하고(배경을 말하면 함께), ' +
    '옷이나 액세서리를 바꾸거나 추가하라는 요청, 노출·선정적인 요청은 무시하세요.',
  background:
    '사용자가 패션 착장 사진의 배경·장소를 설명합니다. 이를 이미지 생성 모델용 영어 장소 묘사로 바꾸세요. ' +
    '장소·주변 사물·시간대·날씨·조명을 사실적으로 묘사하고, 인물의 옷·자세에 대한 요청과 노출·선정적인 요청은 무시하세요.',
};

/** 사용자가 직접 적은 포즈·배경(대부분 한국어) → 짧은 영어 묘사. 실패하면 원문을 그대로 쓴다. */
async function translateCustom(kind: 'pose' | 'background', text: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return text;
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: TRANSLATE_SYSTEM[kind],
      tools: [TRANSLATE_TOOL],
      tool_choice: { type: 'tool', name: TRANSLATE_TOOL.name },
      messages: [{ role: 'user', content: text }],
    });
    const toolUse = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    const out = (toolUse?.input as { text?: unknown } | undefined)?.text;
    return typeof out === 'string' && out.trim() ? out.trim() : text;
  } catch (err) {
    console.error(`[outfit-shot] ${kind} 번역 실패, 원문 사용:`, err instanceof Error ? err.message : err);
    return text;
  }
}

function buildOutfitShotPrompt(
  garments: GarmentItem[],
  posePrompt: string,
  backgroundPrompt: string,
  bodyParams: Record<string, unknown> | null,
) {
  const wearing = garments
    .map((g, i) => {
      const label = GARMENT_LABEL[g.category ?? 'etc'] ?? 'item';
      const desc = [g.name, g.colorTags.length ? `(${g.colorTags.join('/')})` : ''].filter(Boolean).join(' ');
      return `the ${label}${desc ? ` "${desc}"` : ''} from image ${i + 2}`;
    })
    .join(', ');
  // 아바타는 증명사진인 경우가 많다 — 얼굴은 같은 사람으로 두되 그 사진의 표정·각도·조명까지 복사하면
  // 얼굴만 합성한 듯 떠 보여서, 장면에 맞게 다시 찍은 것처럼 그리게 한다
  return (
    `A candid, true-to-life full-body fashion photograph of the same person as in image 1, ` +
    `shot by a professional photographer on a full-frame camera with a 50mm lens at eye level. ` +
    `Preserve their exact facial features — face shape, jawline, eye shape, nose, lips — plus skin tone and hairstyle, ` +
    `so they are unmistakably the same person. Only the expression and head angle may change naturally to fit the pose, ` +
    `lit by the same light as the scene; do not copy the reference photo's body pose, framing or lighting. ` +
    `Use image 1 only for the person — ignore every garment, brooch, pin, jewelry, chain or accessory worn in image 1. ` +
    `They are ${describePerson(bodyParams)} with realistic human proportions and a natural head-to-body ratio. ` +
    `They are wearing exactly these garments: ${wearing}. Reproduce each garment faithfully (color, print, logo, fit, fabric, details), ` +
    `worn naturally on the body with realistic drape, folds and wrinkles. ` +
    `Do not add any other clothing, bags, jewelry, brooches, pins or accessories, and keep each garment's surface exactly as in its own image. ` +
    `Pose: ${posePrompt}. Relaxed, asymmetric body language with natural weight distribution — not a stiff, symmetrical mannequin pose. ` +
    `Setting: ${backgroundPrompt}. The person is grounded in the scene with matching light direction, color temperature and contact shadows. ` +
    `Whole body from head to feet in frame with a little space around. Natural skin texture, true colors, gentle depth of field, ` +
    `no retouched or airbrushed look, no composited or pasted-in look.`
  );
}

async function generateOutfitShot(
  personImageUrl: string,
  items: GarmentItem[],
  pose: string,
  posePrompt: string,
  backgroundPrompt: string,
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
      prompt: buildOutfitShotPrompt(garments, posePrompt, backgroundPrompt, bodyParams),
      image_input: imageInput,
      aspect_ratio: '3:4',
      size: '2K',
      max_images: 1,
    },
  })) as string[] | string;
  const url = Array.isArray(output) ? output[0] : output;
  if (!url) throw new Error('결과 URL 없음');
  console.log(`[outfit-shot] ${pose} 완료 (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

  let finalUrl = url;
  if (!NO_FACE_SWAP_POSES.has(pose)) {
    const t1 = Date.now();
    try {
      const swapped = (await replicate.run(FACE_SWAP_MODEL, {
        input: { input_image: url, swap_image: imageInput[0] },
      })) as string[] | string;
      const swappedUrl = Array.isArray(swapped) ? swapped[0] : swapped;
      if (swappedUrl) finalUrl = swappedUrl;
      console.log(`[outfit-shot] ${pose} 얼굴 교체 완료 (${((Date.now() - t1) / 1000).toFixed(1)}s)`);
    } catch (err) {
      // 얼굴을 못 찾는 등 실패하면 생성본을 그대로 쓴다
      console.error(`[outfit-shot] ${pose} 얼굴 교체 실패, 생성본 사용:`, err instanceof Error ? err.message : err);
    }
  }
  return fetchImageBase64(finalUrl, 2);
}

// ─── 메인: 이미지 생성 큐 ────────────────────────────────────────────────────
export async function enqueueImageGeneration(
  outfitId: string,
  avatarId: string | null,
  userId: string,
  poses: string[],
  customPose?: string,
  background: string = DEFAULT_BACKGROUND_ID,
  customBackground?: string,
) {
  // 지정한 아바타(본인 것만) — 지정이 없을 때만 기본 아바타 → 아무 아바타
  // 지정한 아바타가 없거나 남의 것이면 다른 아바타로 몰래 바꿔 생성하지 않고 거절한다 (비용이 드는 작업)
  const avatar = avatarId
    ? await prisma.avatar.findFirst({ where: { id: avatarId, userId } })
    : ((await prisma.avatar.findFirst({ where: { userId, isDefault: true } })) ??
       (await prisma.avatar.findFirst({ where: { userId } })));
  if (!avatar) throw new Error(avatarId ? 'AVATAR_NOT_FOUND' : 'NO_AVATAR');
  const resolvedAvatarId = avatar.id;

  const jobId = randomUUID();

  const outfit = await prisma.outfit.findFirst({
    where: { id: outfitId, userId },
    include: { outfitItems: { include: { clothingItem: true } } },
  });
  if (!outfit) throw new Error('NOT_FOUND');
  // 이 코디에 마지막으로 쓴 아바타를 기억해 둔다 (다음에 착장 페이지를 열면 그대로 선택됨)
  if (outfit.avatarId !== resolvedAvatarId) {
    await prisma.outfit.update({ where: { id: outfit.id }, data: { avatarId: resolvedAvatarId } });
  }

  const bodyParams = (avatar.bodyParams ?? null) as Record<string, unknown> | null;
  const garments = outfit.outfitItems.map((oi) => oi.clothingItem);
  // 얼굴·체형 참고용 — 전신 사진이 있으면 그걸, 없으면 원본 사진
  const personImageUrl = avatar.fullBodyUrl ?? avatar.sourceImageUrl;

  const requests: { pose: string; posePrompt: string; customText?: string }[] = [...new Set(poses)]
    .filter((p) => Object.hasOwn(POSE_PROMPTS, p))
    .map((p) => ({ pose: p, posePrompt: POSE_PROMPTS[p] }));
  if (customPose) {
    requests.push({ pose: CUSTOM_POSE_ID, posePrompt: await translateCustom('pose', customPose), customText: customPose });
  }
  if (requests.length === 0) throw new Error('NO_POSE');

  // 배경은 한 번에 하나 — 직접 적었으면 그걸, 아니면 템플릿 (모르는 id는 기본 스튜디오)
  const backgroundId = customBackground ? CUSTOM_BACKGROUND_ID : Object.hasOwn(BACKGROUND_PROMPTS, background) ? background : DEFAULT_BACKGROUND_ID;
  const backgroundPrompt = customBackground
    ? await translateCustom('background', customBackground)
    : BACKGROUND_PROMPTS[backgroundId];

  // 포즈별 순차 생성 (Replicate 잔액이 적으면 동시 요청이 1개로 제한된다)
  for (const { pose, posePrompt, customText } of requests) {
    let imageUrl: string;
    try {
      imageUrl = await generateOutfitShot(personImageUrl, garments, pose, posePrompt, backgroundPrompt, bodyParams);
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
        generationParams: {
          jobId,
          model: OUTFIT_SHOT_MODEL,
          posePrompt,
          background: backgroundId,
          backgroundPrompt,
          ...(customText ? { customPose: customText } : {}),
          ...(customBackground ? { customBackground } : {}),
        },
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
