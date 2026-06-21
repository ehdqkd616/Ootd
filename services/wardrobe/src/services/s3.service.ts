import { randomUUID } from 'crypto';

async function tryS3Upload(buffer: Buffer, mimeType: string, key: string, bucket: string): Promise<string | null> {
  try {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const s3 = new S3Client({ region: process.env.AWS_REGION ?? 'ap-northeast-2' });
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: mimeType }));
    return `https://${bucket}.s3.amazonaws.com/${key}`;
  } catch {
    return null;
  }
}

export async function uploadOriginal(buffer: Buffer, mimeType: string, userId: string): Promise<string> {
  const BUCKET = process.env.AWS_S3_BUCKET_USER_IMAGES;
  if (BUCKET) {
    const url = await tryS3Upload(buffer, mimeType, `users/${userId}/original/${randomUUID()}`, BUCKET);
    if (url) return url;
  }
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

export async function uploadThumbnail(buffer: Buffer, userId: string): Promise<string> {
  const sharp = (await import('sharp')).default;
  const thumb = await sharp(buffer).resize(400, 400, { fit: 'inside' }).webp({ quality: 80 }).toBuffer();
  const BUCKET = process.env.AWS_S3_BUCKET_USER_IMAGES;
  if (BUCKET) {
    const url = await tryS3Upload(thumb, 'image/webp', `users/${userId}/thumbnails/${randomUUID()}.webp`, BUCKET);
    if (url) return url;
  }
  return `data:image/webp;base64,${thumb.toString('base64')}`;
}

export async function deleteFile(url: string) {
  if (url.startsWith('data:')) return;
  try {
    const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const s3 = new S3Client({ region: process.env.AWS_REGION ?? 'ap-northeast-2' });
    const key = new URL(url).pathname.slice(1);
    const bucket = new URL(url).hostname.split('.')[0];
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch { /* ignore */ }
}
