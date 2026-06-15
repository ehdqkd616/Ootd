import { prisma } from '@ootd/db';
import type { CreateOutfitRequest } from '@ootd/types';
import { randomUUID } from 'crypto';
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

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
          clothingItemId: item.clothingItemId,
          layerOrder: item.layerOrder,
          positionData: item.positionData ?? {},
        })),
      },
    },
    include: { outfitItems: { include: { clothingItem: true } } },
  });
}

export async function deleteOutfit(id: string, userId: string) {
  const outfit = await prisma.outfit.findFirst({ where: { id, userId } });
  if (!outfit) throw new Error('NOT_FOUND');
  await prisma.outfit.delete({ where: { id } });
}

export async function enqueueImageGeneration(outfitId: string, avatarId: string, poses: string[]) {
  const jobId = randomUUID();
  const job = { jobId, outfitId, avatarId, poses, status: 'queued', createdAt: Date.now() };

  await redis.setex(`job:${jobId}`, 3600, JSON.stringify(job));
  // TODO: Publish to SQS for AI Orchestration Service

  return { jobId, status: 'queued' as const };
}

export async function getJob(jobId: string) {
  const raw = await redis.get(`job:${jobId}`);
  if (!raw) throw new Error('NOT_FOUND');
  return JSON.parse(raw) as { jobId: string; status: string; progress?: number };
}

export async function getGeneratedImages(outfitId: string, userId: string) {
  const outfit = await prisma.outfit.findFirst({ where: { id: outfitId, userId } });
  if (!outfit) throw new Error('NOT_FOUND');
  return prisma.generatedImage.findMany({ where: { outfitId }, orderBy: { createdAt: 'desc' } });
}
