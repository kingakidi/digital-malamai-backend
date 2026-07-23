import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ALLOWED_FILE_TYPES,
  DEFAULT_PRESIGNED_EXPIRY_SECONDS,
  MAX_FILE_SIZE,
  PRESIGNED_EXPIRY_MAX_SECONDS,
  UPLOAD_FOLDERS,
  UploadFolder,
} from './media.config';
import {
  extractS3KeyFromUrl,
  ExtractS3KeyOptions,
  isLikelyS3Key,
} from './utils/extract-s3-key.util';

@Injectable()
export class S3Service implements OnModuleInit {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client | null;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly endpoint?: string;
  private readonly bucketUrl?: string;
  private readonly forcePathStyle: boolean;
  private readonly presignedExpirySeconds: number;
  private bucketReady = false;
  private ensureBucketPromise: Promise<void> | null = null;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>('media.bucketName') ?? '';
    this.region = this.configService.get<string>('media.region') ?? 'us-east-1';
    this.endpoint = this.configService.get<string>('media.endpoint');
    this.bucketUrl =
      this.configService.get<string>('media.bucketUrl') || undefined;
    this.forcePathStyle =
      this.configService.get<boolean>('media.forcePathStyle') ?? true;
    this.presignedExpirySeconds =
      this.configService.get<number>('media.presignedExpirySeconds') ??
      DEFAULT_PRESIGNED_EXPIRY_SECONDS;

    if (this.isConfigured()) {
      this.client = new S3Client({
        region: this.region,
        credentials: {
          accessKeyId:
            this.configService.get<string>('media.accessKeyId') ?? '',
          secretAccessKey:
            this.configService.get<string>('media.secretAccessKey') ?? '',
        },
        ...(this.getBaseEndpoint() && { endpoint: this.getBaseEndpoint() }),
        forcePathStyle: this.forcePathStyle,
      });
    } else {
      this.client = null;
    }
  }

  async onModuleInit(): Promise<void> {
    if (!this.isConfigured() || !this.client) {
      return;
    }

    try {
      await this.ensureBucketExists();
    } catch (error) {
      this.logger.warn(
        `Could not ensure S3 bucket "${this.bucketName}" on startup: ${formatS3Error(error, this.bucketName)}. Will retry on upload.`,
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(
      this.configService.get<string>('media.accessKeyId') &&
        this.configService.get<string>('media.secretAccessKey') &&
        this.configService.get<string>('media.bucketName'),
    );
  }

  getAllowedFileTypes(): readonly string[] {
    return ALLOWED_FILE_TYPES;
  }

  getMaxFileSizeBytes(): number {
    return (
      this.configService.get<number>('media.maxFileSizeBytes') ?? MAX_FILE_SIZE
    );
  }

  getDefaultPresignedExpirySeconds(): number {
    return this.presignedExpirySeconds;
  }

  getPresignedExpiryMaxSeconds(): number {
    return PRESIGNED_EXPIRY_MAX_SECONDS;
  }

  resolveUploadFolder(folder?: string): UploadFolder {
    const normalized = folder?.trim();
    const allowed = Object.values(UPLOAD_FOLDERS) as string[];
    if (normalized && allowed.includes(normalized)) {
      return normalized as UploadFolder;
    }
    return UPLOAD_FOLDERS.MEDIA;
  }

  generateFileKey(folder: string, filename: string): string {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = filename.split('.').pop();
    const nameWithoutExt = filename.split('.').slice(0, -1).join('.');

    return `${folder}/${nameWithoutExt}-${timestamp}-${randomString}.${extension}`;
  }

  generateS3Url(key: string): string {
    const normalizedKey = key.replace(/^\/+/, '');
    const publicBase = (this.bucketUrl || this.endpoint || '')
      .trim()
      .replace(/\/+$/, '');

    if (!publicBase) {
      throw new InternalServerErrorException(
        'S3_BUCKET_URL or S3_ENDPOINT must be set for media URLs',
      );
    }

    // Contabo / MinIO path-style: https://host/bucket/key
    if (this.forcePathStyle && this.bucketName) {
      return `${publicBase}/${this.bucketName}/${normalizedKey}`;
    }

    return `${publicBase}/${normalizedKey}`;
  }

  extractKeyFromUrl(url: string | null | undefined): string | null {
    return extractS3KeyFromUrl(url, this.getExtractKeyOptions());
  }

  isLikelyS3Key(value: string | null | undefined): boolean {
    if (!value) {
      return false;
    }
    return isLikelyS3Key(value);
  }

  async upload(params: {
    buffer: Buffer;
    mimetype: string;
    originalName: string;
    folder?: string;
  }): Promise<{ url: string; key: string } | null> {
    if (!this.isConfigured() || !this.client) {
      return null;
    }

    await this.ensureBucketExists();

    const folder = this.resolveUploadFolder(params.folder);
    const key = this.generateFileKey(folder, params.originalName || 'file');
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: params.buffer,
      ContentType: params.mimetype || 'application/octet-stream',
    });

    try {
      await this.client.send(command);
    } catch (error) {
      if (isNotFoundError(error)) {
        this.bucketReady = false;
        await this.ensureBucketExists();
        try {
          await this.client.send(command);
          return {
            key,
            url: this.generateS3Url(key),
          };
        } catch (retryError) {
          const detail = formatS3Error(retryError, this.bucketName);
          this.logger.error(
            `S3 PutObject failed after bucket ensure (bucket=${this.bucketName}, key=${key}): ${detail}`,
          );
          throw new InternalServerErrorException(`S3 upload failed: ${detail}`);
        }
      }

      const detail = formatS3Error(error, this.bucketName);
      this.logger.error(
        `S3 PutObject failed (bucket=${this.bucketName}, key=${key}): ${detail}`,
      );
      throw new InternalServerErrorException(`S3 upload failed: ${detail}`);
    }

    return {
      key,
      url: this.generateS3Url(key),
    };
  }

  private async ensureBucketExists(): Promise<void> {
    if (!this.client || !this.bucketName || this.bucketReady) {
      return;
    }

    if (this.ensureBucketPromise) {
      return this.ensureBucketPromise;
    }

    this.ensureBucketPromise = (async () => {
      try {
        await this.client!.send(
          new HeadBucketCommand({ Bucket: this.bucketName }),
        );
        this.bucketReady = true;
        return;
      } catch (error) {
        if (!isNotFoundError(error)) {
          throw error;
        }
      }

      this.logger.log(
        `S3 bucket "${this.bucketName}" not found — creating it…`,
      );

      try {
        await this.client!.send(
          new CreateBucketCommand({ Bucket: this.bucketName }),
        );
        this.logger.log(`S3 bucket "${this.bucketName}" created`);
        this.bucketReady = true;
      } catch (error) {
        if (isBucketAlreadyExistsError(error)) {
          this.bucketReady = true;
          return;
        }
        throw error;
      }
    })().finally(() => {
      this.ensureBucketPromise = null;
    });

    return this.ensureBucketPromise;
  }

  async delete(key: string): Promise<boolean> {
    if (!this.isConfigured() || !this.client || !key.trim()) {
      return false;
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  async getPresignedUrl(
    key: string,
    expiresInSeconds: number = this.presignedExpirySeconds,
  ): Promise<string | null> {
    if (!this.isConfigured() || !this.client) {
      return null;
    }

    const expiresIn = Math.min(
      Math.max(expiresInSeconds, 60),
      PRESIGNED_EXPIRY_MAX_SECONDS,
    );

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  private getExtractKeyOptions(): ExtractS3KeyOptions {
    return {
      bucketName: this.bucketName,
      endpoint: this.bucketUrl || this.endpoint,
      region: this.region,
    };
  }

  private getBaseEndpoint(): string | undefined {
    if (!this.endpoint) {
      return undefined;
    }

    if (this.endpoint.includes(`/${this.bucketName}`)) {
      return this.endpoint.replace(`/${this.bucketName}`, '');
    }

    return this.endpoint;
  }
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as {
    name?: string;
    Code?: string;
    code?: string;
    $metadata?: { httpStatusCode?: number };
  };

  const status = err.$metadata?.httpStatusCode;
  const code = (err.Code ?? err.code ?? err.name ?? '').toString();

  return status === 404 || /notfound|nosuchbucket/i.test(code);
}

function isBucketAlreadyExistsError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as {
    name?: string;
    Code?: string;
    code?: string;
    $metadata?: { httpStatusCode?: number };
  };

  const status = err.$metadata?.httpStatusCode;
  const code = (err.Code ?? err.code ?? err.name ?? '').toString();

  return (
    status === 409 ||
    /bucketalreadyownedbyyou|bucketalreadyexists/i.test(code)
  );
}

function formatS3Error(error: unknown, bucketName: string): string {
  if (!error || typeof error !== 'object') {
    return String(error);
  }

  const err = error as {
    name?: string;
    message?: string;
    Code?: string;
    code?: string;
    $metadata?: { httpStatusCode?: number; requestId?: string };
  };

  const status = err.$metadata?.httpStatusCode;
  const code = err.Code ?? err.code ?? err.name;
  const message = err.message?.trim();
  const requestId = err.$metadata?.requestId;

  const parts: string[] = [];
  if (status) {
    parts.push(`HTTP ${status}`);
  }
  if (code && code !== 'UnknownError') {
    parts.push(String(code));
  }
  if (message && message !== 'UnknownError') {
    parts.push(message);
  } else if (status === 404) {
    parts.push(
      `bucket "${bucketName}" not found — create it in Contabo Object Storage`,
    );
  } else if (!parts.length) {
    parts.push(message || 'Unknown S3 error');
  }
  if (requestId) {
    parts.push(`requestId=${requestId}`);
  }

  return parts.join(' | ');
}
