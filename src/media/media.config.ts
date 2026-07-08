import { registerAs } from '@nestjs/config';

export const UPLOAD_FOLDERS = {
  MEDIA: 'media',
  IMAGES: 'images',
  PARTNERS: 'partners',
} as const;

export type UploadFolder = (typeof UPLOAD_FOLDERS)[keyof typeof UPLOAD_FOLDERS];

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/jpg',
] as const;

export const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

export default registerAs('media', () => ({
  accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
  region: process.env.S3_REGION ?? 'us-east-1',
  bucketName: process.env.S3_BUCKET_NAME ?? '',
  endpoint: process.env.S3_ENDPOINT || undefined,
  publicBaseUrl: process.env.S3_PUBLIC_BASE_URL || undefined,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
  allowedImageMimeTypes: ALLOWED_IMAGE_MIME_TYPES,
  maxImageSizeBytes: MAX_IMAGE_SIZE_BYTES,
  presignedExpirySeconds: 3600,
}));
