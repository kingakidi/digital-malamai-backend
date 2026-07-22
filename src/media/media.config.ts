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

/** Fallback only when MEDIA_MAX_UPLOAD_BYTES is unset or invalid. */
const DEFAULT_MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

function resolveMaxUploadBytes(): number {
  const raw = process.env.MEDIA_MAX_UPLOAD_BYTES?.trim();
  if (!raw) {
    return DEFAULT_MAX_UPLOAD_BYTES;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_UPLOAD_BYTES;
  }

  return Math.floor(parsed);
}

/**
 * Node on Windows often resolves `localhost` to IPv6 (::1) first.
 * Local MinIO/S3 typically listens on IPv4 only, which causes
 * `ECONNREFUSED ::1:9000`. Prefer 127.0.0.1 for loopback hosts.
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
  endpoint: preferIpv4Loopback(process.env.S3_ENDPOINT) || undefined,
  publicBaseUrl: preferIpv4Loopback(process.env.S3_PUBLIC_BASE_URL) || undefined,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
  allowedImageMimeTypes: ALLOWED_IMAGE_MIME_TYPES,
  maxImageSizeBytes: resolveMaxUploadBytes(),
  presignedExpirySeconds: 3600,
}));
