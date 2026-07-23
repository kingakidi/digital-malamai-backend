import { registerAs } from '@nestjs/config';

/**
 * Mirrors fileam-backend-api-enterprise `MEDIA_CONFIG` / `S3_CONFIG`.
 * `partners` is kept for Digital Malamai domain uploads (logos).
 */
export const UPLOAD_FOLDERS = {
  MEDIA: 'media',
  IMAGES: 'images',
  VIDEOS: 'videos',
  DOCUMENTS: 'documents',
  MENU_ITEMS: 'menu-items',
  CATEGORIES: 'categories',
  BRANCHES: 'branches',
  USERS: 'users',
  PARTNERS: 'partners',
} as const;

export type UploadFolder = (typeof UPLOAD_FOLDERS)[keyof typeof UPLOAD_FOLDERS];

export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/jpg',
  'video/mp4',
  'video/avi',
  'video/mov',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

/** Same as Fileam: 10MB */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const DEFAULT_PRESIGNED_EXPIRY_SECONDS = 3600;
export const PRESIGNED_EXPIRY_MAX_SECONDS = 604800;

/**
 * Node on Windows often resolves `localhost` to IPv6 (::1) first.
 * Prefer 127.0.0.1 for loopback hosts (MinIO / local S3).
 */
function preferIpv4Loopback(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }

  return url
    .replace(/:\/\/localhost(?=[:/]|$)/gi, '://127.0.0.1')
    .replace(/:\/\/\[::1\](?=[:/]|$)/gi, '://127.0.0.1');
}

export default registerAs('media', () => ({
  accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
  region: process.env.S3_REGION ?? 'us-east-1',
  bucketName: process.env.S3_BUCKET_NAME ?? '',
  /** Loaded like Fileam; not used for URL generation. */
  bucketUrl: preferIpv4Loopback(process.env.S3_BUCKET_URL) || '',
  endpoint: preferIpv4Loopback(process.env.S3_ENDPOINT) || undefined,
  /** Fileam documents this but always forces path style on the client. */
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  allowedFileTypes: ALLOWED_FILE_TYPES,
  maxFileSizeBytes: MAX_FILE_SIZE,
  presignedExpirySeconds: DEFAULT_PRESIGNED_EXPIRY_SECONDS,
}));
