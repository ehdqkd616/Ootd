import { prisma } from '@ootd/db';
import type { WardrobeFilter } from '@ootd/types';
import { uploadOriginal, uploadThumbnail, deleteFile } from './s3.service';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VALID_CATEGORIES = ['top', 'bottom', 'outer', 'shoes', 'accessory', 'etc'];

async function analyzeClothingImage(buffer: Buffer, mimeType: string): Promise<{
  name?: string; category?: string; colorTags?: string[];
  brand?: string; seasonTags?: string[]; styleTags?: string[];
}> {
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
              data: buffer.toString('base64'),
            },
          },
          {
            type: 'text',
            text: `이 의류 이미지를 분석해서 JSON으로만 응답하세요 (다른 텍스트 없이):
{
  "name": "구체적인 이름 (예: 검정 슬랙스, 화이트 오버핏 티셔츠, 베이지 트렌치코트)",
  "category": "top|bottom|outer|shoes|accessory|etc 중 정확히 하나",
  "colorTags": ["주색상", "보조색상"],
  "brand": "브랜드명 또는 null",
  "seasonTags": ["봄", "여름", "가을", "겨울"] 중 해당 계절,
  "styleTags": ["캐주얼", "포멀", "스포티", "빈티지", "미니멀", "스트리트"] 중 해당하는 것
}`,
          },
        ],
      }],
    });

    const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '{}';
    const jsonStr = text.replace(/^```json\n?|\n?```$/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    return {
      name: typeof parsed.name === 'string' ? parsed.name : undefined,
      category: VALID_CATEGORIES.includes(parsed.category) ? parsed.category : 'etc',
      colorTags: Array.isArray(parsed.colorTags) ? parsed.colorTags.slice(0, 5) : [],
      brand: typeof parsed.brand === 'string' && parsed.brand !== 'null' ? parsed.brand : undefined,
      seasonTags: Array.isArray(parsed.seasonTags) ? parsed.seasonTags : [],
      styleTags: Array.isArray(parsed.styleTags) ? parsed.styleTags : [],
    };
  } catch {
    return {};
  }
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

export async function createFromUpload(
  userId: string,
  fileBuffer: Buffer,
  mimeType: string,
  meta: Record<string, string | string[]>,
) {
  const [[originalImageUrl, thumbnailUrl], aiMeta] = await Promise.all([
    Promise.all([
      uploadOriginal(fileBuffer, mimeType, userId),
      uploadThumbnail(fileBuffer, userId),
    ]),
    analyzeClothingImage(fileBuffer, mimeType),
  ]);

  return prisma.clothingItem.create({
    data: {
      userId,
      originalImageUrl,
      thumbnailUrl,
      name: (meta.name as string) || aiMeta.name,
      category: (meta.category as string) || aiMeta.category,
      brand: (meta.brand as string) || aiMeta.brand,
      colorTags: aiMeta.colorTags ?? [],
      seasonTags: aiMeta.seasonTags ?? [],
      styleTags: aiMeta.styleTags ?? [],
    },
  });
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
