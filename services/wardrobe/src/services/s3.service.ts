import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

const s3 = new S3Client({ region: process.env.AWS_REGION ?? 'ap-northeast-2' });

const BUCKET_USER = process.env.AWS_S3_BUCKET_USER_IMAGES!;
const BUCKET_PROCESSED = process.env.AWS_S3_BUCKET_PROCESSED_IMAGES!;

export async function uploadOriginal(buffer: Buffer, mimeType: string, userId: string) {
  const key = `users/${userId}/original/${randomUUID()}`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET_USER,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  }));
  return `https://${BUCKET_USER}.s3.amazonaws.com/${key}`;
}

export async function uploadThumbnail(buffer: Buffer, userId: string) {
  const thumb = await sharp(buffer).resize(400, 400, { fit: 'inside' }).webp({ quality: 80 }).toBuffer();
  const key = `users/${userId}/thumbnails/${randomUUID()}.webp`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET_USER,
    Key: key,
    Body: thumb,
    ContentType: 'image/webp',
  }));
  return `https://${BUCKET_USER}.s3.amazonaws.com/${key}`;
}

export async function deleteFile(url: string) {
  const key = new URL(url).pathname.slice(1);
  const bucket = new URL(url).hostname.split('.')[0];
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function getPresignedUrl(bucket: string, key: string) {
  return getSignedUrl(s3, new PutObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 3600 });
}
