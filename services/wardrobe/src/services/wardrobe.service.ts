import { prisma } from '@ootd/db';
import type { WardrobeFilter } from '@ootd/types';
import { uploadOriginal, uploadThumbnail, deleteFile } from './s3.service';

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
  const [originalImageUrl, thumbnailUrl] = await Promise.all([
    uploadOriginal(fileBuffer, mimeType, userId),
    uploadThumbnail(fileBuffer, userId),
  ]);

  // AI 파이프라인에 배경 제거 + 분류 작업 큐잉 (비동기)
  // TODO: SQS 메시지 발행

  return prisma.clothingItem.create({
    data: {
      userId,
      originalImageUrl,
      thumbnailUrl,
      name: meta.name as string | undefined,
      category: meta.category as string | undefined,
      brand: meta.brand as string | undefined,
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
