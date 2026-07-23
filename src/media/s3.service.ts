import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
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

/**
 * Nest port of Fileam `src/config/s3.ts` + `mediaUploadService.ts`.
 * View/serve always uses GetObject presigned URLs (no public-base-url shortcut).
 */
@Injectable()
export class S3Service {
  private readonly client: S3Client | null;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly endpoint?: string;
  private readonly presignedExpirySeconds: number;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>('media.bucketName') ?? '';
    this.region = this.configService.get<string>('media.region') ?? 'us-east-1';
    this.endpoint = this.configService.get<string>('media.endpoint');
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
        // Fileam always sets forcePathStyle: true (env flag is ignored for the client).
        forcePathStyle: true,
      });
    } else {
      this.client = null;
    }
  }

  /** Fileam `validateS3Config` (silent boolean; errors surface via API messages). */
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

  /** Fileam `generateFileKey` */
  generateFileKey(folder: string, filename: string): string {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = filename.split('.').pop();
    const nameWithoutExt = filename.split('.').slice(0, -1).join('.');

    return `${folder}/${nameWithoutExt}-${timestamp}-${randomString}.${extension}`;
  }

  /** Fileam `generateS3Url` */
  generateS3Url(key: string): string {
    if (this.endpoint) {
      return `${this.endpoint.replace(/\/+$/, '')}/${key}`;
    }
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
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

  /** Fileam `uploadToS3` */
  async upload(params: {
    buffer: Buffer;
    mimetype: string;
    originalName: string;
    folder?: string;
  }): Promise<{ url: string; key: string } | null> {
    if (!this.isConfigured() || !this.client) {
      return null;
    }

    const folder = this.resolveUploadFolder(params.folder);
    const key = this.generateFileKey(folder, params.originalName || 'file');
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: params.buffer,
      ContentType: params.mimetype || 'application/octet-stream',
    });

    await this.client.send(command);
    return {
      key,
      url: this.generateS3Url(key),
    };
  }

  /** Fileam `deleteFromS3` */
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

  /** Fileam `getPresignedUrl` — used for both `/view` redirect and `/presigned`. */
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
      endpoint: this.endpoint,
      region: this.region,
    };
  }

  /** Fileam `getBaseEndpoint` */
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
