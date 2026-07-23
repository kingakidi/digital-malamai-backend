import { UPLOAD_FOLDERS } from '../media.config';

const UPLOAD_FOLDER_VALUES = Object.values(UPLOAD_FOLDERS);
const S3_KEY_PREFIX_PATTERN = new RegExp(
  `^(${UPLOAD_FOLDER_VALUES.map((folder) => folder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})/.+`,
);

export function isLikelyS3Key(value: string): boolean {
  return S3_KEY_PREFIX_PATTERN.test(value.trim());
}

export type ExtractS3KeyOptions = {
  bucketName?: string;
  endpoint?: string;
  region?: string;
};

export function extractS3KeyFromUrl(
  url: string | null | undefined,
  options: ExtractS3KeyOptions = {},
): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  if (isLikelyS3Key(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const pathname = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));

    if (options.endpoint) {
      const endpointHost = new URL(options.endpoint).host;
      if (parsed.host === endpointHost) {
        let key = pathname;
        if (options.bucketName && key.startsWith(`${options.bucketName}/`)) {
          key = key.slice(options.bucketName.length + 1);
        }
        if (isLikelyS3Key(key)) {
          return key;
        }
      }
    }

    if (
      options.bucketName &&
      parsed.host.startsWith(`${options.bucketName}.s3`)
    ) {
      if (isLikelyS3Key(pathname)) {
        return pathname;
      }
    }

    const folderPattern = UPLOAD_FOLDER_VALUES.map((folder) =>
      folder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    ).join('|');
    const pathMatch = pathname.match(
      new RegExp(`((?:${folderPattern})/.+)$`),
    );
    if (pathMatch) {
      return pathMatch[1];
    }

    const keyParam = parsed.searchParams.get('key')?.trim();
    if (keyParam && isLikelyS3Key(keyParam)) {
      return keyParam;
    }
  } catch {
    return null;
  }

  return null;
}
