import { prisma } from '@ootd/db';
import type { WardrobeFilter } from '@ootd/types';
import { uploadOriginal, uploadThumbnail, deleteFile } from './s3.service';
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VALID_CATEGORIES = ['top', 'bottom', 'outer', 'shoes', 'accessory', 'etc'];
const SEASONS = ['봄', '여름', '가을', '겨울'];
const STYLES = ['캐주얼', '포멀', '스포티', '빈티지', '미니멀', '스트리트'];
const COLORS = ['검정', '흰색', '회색', '네이비', '베이지', '브라운', '빨강', '파랑', '초록', '노랑', '분홍', '보라', '카키'];

// 분석용으로 줄인 이미지의 긴 변 — 박스 좌표도 이 크기 기준으로 받는다
const ANALYZE_MAX = 1024;

interface DetectedGarment {
  name?: string;
  category: string;
  colorTags: string[];
  brand?: string;
  seasonTags: string[];
  styleTags: string[];
  box?: [number, number, number, number]; // 분석 이미지 기준 픽셀 [x0, y0, x1, y1]
}

const REPORT_TOOL: Anthropic.Tool = {
  name: 'report_clothing',
  description: '사진에서 찾은 의류 아이템 목록을 보고한다.',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: '구체적인 이름 (예: 검정 슬랙스, 화이트 오버핏 티셔츠, 베이지 트렌치코트)' },
            category: { type: 'string', enum: VALID_CATEGORIES },
            colorTags: { type: 'array', items: { type: 'string' }, description: `주색상, 보조색상. 가능하면 ${COLORS.join('/')} 중에서` },
            brand: { type: 'string', description: '로고 등으로 확실히 보일 때만, 아니면 빈 문자열' },
            seasonTags: { type: 'array', items: { type: 'string', enum: SEASONS } },
            styleTags: { type: 'array', items: { type: 'string', enum: STYLES } },
            box: {
              type: 'array',
              items: { type: 'integer' },
              description: '그 아이템만 감싸는 영역 [x_min, y_min, x_max, y_max] (픽셀 좌표)',
            },
          },
          required: ['name', 'category', 'colorTags', 'seasonTags', 'styleTags', 'box'],
        },
      },
    },
    required: ['items'],
  },
};

/**
 * 사진 속 의류를 모두 찾는다 — 전신 사진이면 상의·하의·신발 등을 각각, 상품 사진이면 1개.
 * 위치(박스)까지 정확해야 잘라낼 수 있어서 Opus를 쓴다 (Haiku는 박스가 크게 어긋나고 없는 아이템을 지어냈다).
 */
async function detectGarments(analyzeBuf: Buffer, width: number, height: number): Promise<DetectedGarment[]> {
  const msg = await anthropic.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 4096,
    // SDK 0.39 타입에 아직 없는 필드
    ...({ output_config: { effort: 'low' } } as object),
    tools: [REPORT_TOOL],
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: analyzeBuf.toString('base64') } },
        {
          type: 'text',
          text: `옷장에 등록할 사진입니다 (${width}x${height}px). 사진 속 의류 아이템을 각각 찾아 report_clothing 도구로 보고하세요.
- 사람이 입은 사진이면 실제로 착용한 아이템(상의, 하의, 아우터, 신발, 가방·모자 등)을 각각 따로
- 옷만 찍은 상품 사진이면 그 아이템 하나
- 일부만 보이거나 확실하지 않은 아이템은 넣지 마세요`,
        },
      ],
    }],
  } as Anthropic.MessageCreateParamsNonStreaming);

  const toolUse = msg.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  if (!toolUse) throw new Error(`분석 응답에 도구 호출 없음 (stop_reason: ${msg.stop_reason})`);
  const raw = (toolUse.input as { items?: unknown }).items;
  if (!Array.isArray(raw)) return [];

  const strings = (v: unknown, allowed?: string[]) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && (!allowed || allowed.includes(x))) : [];

  return raw.map((it: Record<string, unknown>) => {
    const b = Array.isArray(it.box) ? it.box.map(Number) : [];
    const box = b.length === 4 && b.every(Number.isFinite) && b[2] > b[0] && b[3] > b[1]
      ? (b as [number, number, number, number])
      : undefined;
    return {
      name: typeof it.name === 'string' && it.name ? it.name : undefined,
      category: VALID_CATEGORIES.includes(it.category as string) ? (it.category as string) : 'etc',
      colorTags: strings(it.colorTags).slice(0, 5),
      brand: typeof it.brand === 'string' && it.brand && it.brand !== 'null' ? it.brand : undefined,
      seasonTags: strings(it.seasonTags, SEASONS),
      styleTags: strings(it.styleTags, STYLES),
      box,
    };
  });
}

/** 박스를 원본 해상도로 옮기고 여백을 조금 둔 뒤 잘라낸다. 박스가 사진 대부분이면 자르지 않는다. */
async function cropGarment(full: Buffer, fullW: number, fullH: number, box: DetectedGarment['box'], scale: number) {
  if (!box) return full;
  let [x0, y0, x1, y1] = box.map((v) => v / scale);
  const padX = (x1 - x0) * 0.06;
  const padY = (y1 - y0) * 0.06;
  x0 = Math.max(0, Math.floor(x0 - padX));
  y0 = Math.max(0, Math.floor(y0 - padY));
  x1 = Math.min(fullW, Math.ceil(x1 + padX));
  y1 = Math.min(fullH, Math.ceil(y1 + padY));
  const w = x1 - x0;
  const h = y1 - y0;
  if (w < 32 || h < 32 || (w * h) / (fullW * fullH) > 0.85) return full;
  return sharp(full).extract({ left: x0, top: y0, width: w, height: h }).jpeg({ quality: 90 }).toBuffer();
}

export async function listItems(userId: string, filters: WardrobeFilter) {
  const { category, search, isArchived = false, page = 1, limit = 20 } = filters;

  const where = {
    userId,
    isArchived,
    ...(category && { category }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { brand: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  };

  const [data, total] = await Promise.all([
    prisma.clothingItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.clothingItem.count({ where }),
  ]);

  return { data, total, page, limit, hasNext: page * limit < total };
}

export async function getItem(id: string, userId: string) {
  const item = await prisma.clothingItem.findFirst({ where: { id, userId } });
  if (!item) throw new Error('NOT_FOUND');
  return item;
}

/**
 * 업로드 사진 한 장 → 옷 아이템 N개. 전신 사진은 아이템별로 잘라 각각 등록한다.
 * 분석이 실패하면 사진 전체를 미분류 아이템 1개로 저장한다 (업로드 자체는 성공).
 */
export async function createFromUpload(
  userId: string,
  fileBuffer: Buffer,
  mimeType: string,
  meta: Record<string, string | string[]>,
) {
  // 휴대폰 사진은 EXIF로만 회전돼 있어서, 먼저 실제 방향으로 돌려두고 좌표·자르기를 모두 이 기준으로 한다
  const full = await sharp(fileBuffer).rotate().jpeg({ quality: 92 }).toBuffer();
  const { width: fullW = 0, height: fullH = 0 } = await sharp(full).metadata();
  const scale = Math.min(1, ANALYZE_MAX / Math.max(fullW, fullH));
  const analyzeBuf = await sharp(full).resize(Math.round(fullW * scale), Math.round(fullH * scale)).jpeg({ quality: 85 }).toBuffer();

  let garments: DetectedGarment[] = [];
  try {
    garments = await detectGarments(analyzeBuf, Math.round(fullW * scale), Math.round(fullH * scale));
  } catch (err) {
    console.error('[wardrobe] 의류 분석 실패:', err instanceof Error ? err.message : err);
  }
  if (garments.length === 0) {
    garments = [{ category: 'etc', colorTags: [], seasonTags: [], styleTags: [] }];
  }
  // 종류를 지정하면 그 종류의 아이템 하나만 등록한다 (모델 착용 사진에서 원하는 옷만 잘라내기)
  const wanted = typeof meta.category === 'string' && VALID_CATEGORIES.includes(meta.category) ? meta.category : null;
  if (wanted) {
    const area = (g: DetectedGarment) => (g.box ? (g.box[2] - g.box[0]) * (g.box[3] - g.box[1]) : 0);
    const match = garments.filter((g) => g.category === wanted).sort((a, b) => area(b) - area(a))[0];
    garments = [match ?? { ...garments[0], category: wanted, box: undefined }];
  } else if (meta.name) {
    // 이름만 직접 입력하면 사진 전체를 아이템 1개로 본다
    garments = [{ ...garments[0], box: undefined }];
  }

  const created = [];
  for (const g of garments) {
    const image = await cropGarment(full, fullW, fullH, g.box, scale);
    const [originalImageUrl, thumbnailUrl] = await Promise.all([
      uploadOriginal(image, 'image/jpeg', userId),
      uploadThumbnail(image, userId),
    ]);
    created.push(
      await prisma.clothingItem.create({
        data: {
          userId,
          originalImageUrl,
          thumbnailUrl,
          name: (meta.name as string) || g.name,
          category: (meta.category as string) || g.category,
          brand: (meta.brand as string) || g.brand,
          colorTags: g.colorTags,
          seasonTags: g.seasonTags,
          styleTags: g.styleTags,
        },
      }),
    );
  }
  return created;
}

export async function createFromUrl(userId: string, sourceUrl: string, meta: Record<string, string | string[]>) {
  // AI 파이프라인이 URL에서 이미지를 가져와 처리 (큐잉)
  // TODO: SQS 메시지 발행

  return prisma.clothingItem.create({
    data: {
      userId,
      originalImageUrl: sourceUrl,
      sourceUrl,
      name: meta.name as string | undefined,
      category: meta.category as string | undefined,
    },
  });
}

export async function updateItem(id: string, userId: string, data: Partial<{
  name: string; category: string; subcategory: string;
  colorTags: string[]; seasonTags: string[]; styleTags: string[]; brand: string;
}>) {
  const item = await prisma.clothingItem.findFirst({ where: { id, userId } });
  if (!item) throw new Error('NOT_FOUND');
  return prisma.clothingItem.update({ where: { id }, data });
}

export async function deleteItem(id: string, userId: string) {
  const item = await prisma.clothingItem.findFirst({ where: { id, userId } });
  if (!item) throw new Error('NOT_FOUND');

  await Promise.all([
    item.originalImageUrl && deleteFile(item.originalImageUrl),
    item.processedImageUrl && deleteFile(item.processedImageUrl),
    item.thumbnailUrl && deleteFile(item.thumbnailUrl),
  ].filter(Boolean));

  await prisma.clothingItem.delete({ where: { id } });
}

export async function archiveItem(id: string, userId: string) {
  const item = await prisma.clothingItem.findFirst({ where: { id, userId } });
  if (!item) throw new Error('NOT_FOUND');
  return prisma.clothingItem.update({ where: { id }, data: { isArchived: true } });
}
