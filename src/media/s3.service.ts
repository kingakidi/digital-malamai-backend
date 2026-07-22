import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  UPLOAD_FOLDERS,
  UploadFolder,
} from './media.config';
import {
  extractS3KeyFromUrl,
  ExtractS3KeyOptions,
  isLikelyS3Key,
} from './utils/extract-s3-key.util';

const PRESIGNED_EXPIRY_MAX_SECONDS = 604800;

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client | null;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly endpoint?: string;
  private readonly publicBaseUrl?: string;
  private readonly presignedExpirySeconds: number;
  private readonly maxImageSizeBytes: number;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>('media.bucketName') ?? '';
    this.region = this.configService.get<string>('media.region') ?? 'us-east-1';
    this.endpoint = this.configService.get<string>('media.endpoint');
    this.publicBaseUrl = this.configService.get<string>('media.publicBaseUrl');
    this.presignedExpirySeconds =
      this.configService.get<number>('media.presignedExpirySeconds') ?? 3600;
    this.maxImageSizeBytes =
      this.configService.get<number>('media.maxImageSizeBytes') ?? 2 * 1024 * 1024;

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
        forcePathStyle:
          this.configService.get<boolean>('media.forcePathStyle') ?? true,
      });
    } else {
      this.client = null;
    }
  }

  isConfigured(): boolean {
    return Boolean(
      this.configService.get<string>('media.accessKeyId') &&
        this.configService.get<string>('media.secretAccessKey') &&
        this.configService.get<string>('media.bucketName'),
    );
  }

  getAllowedImageMimeTypes(): readonly string[] {
    return ALLOWED_IMAGE_MIME_TYPES;
  }

  getMaxImageSizeBytes(): number {
    return this.maxImageSizeBytes;
  }

  resolveUploadFolder(folder?: string): UploadFolder {
    const normalized = folder?.trim().toLowerCase();
    const allowed = Object.values(UPLOAD_FOLDERS) as string[];
    if (normalized && allowed.includes(normalized)) {
      return normalized as UploadFolder;
    }
    return UPLOAD_FOLDERS.MEDIA;
  }

  generateFileKey(folder: string, filename: string): string {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const parts = filename.split('.');
    const extension = parts.length > 1 ? parts.pop() : 'bin';
    const nameWithoutExt = parts.join('.') || 'file';

    return `${folder}/${nameWithoutExt}-${timestamp}-${randomString}.${extension}`;
  }

  buildDirectUrl(key: string): string {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/+$/, '')}/${key}`;
    }

    if (this.endpoint) {
      return `${this.endpoint.replace(/\/+$/, '')}/${key}`;
    }

    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
  }

  usesPublicUrls(): boolean {
    return Boolean(this.publicBaseUrl);
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
  }): Promise<{ url: string; key: string }> {
    this.assertConfigured();

    const folder = this.resolveUploadFolder(params.folder);
    const key = this.generateFileKey(folder, params.originalName || 'file');
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: params.buffer,
      ContentType: params.mimetype || 'application/octet-stream',
    });

    await this.client!.send(command);

    return {
      key,
      url: this.buildDirectUrl(key),
    };
  }

  async delete(key: string): Promise<boolean> {
    if (!this.isConfigured() || !key.trim()) {
      return false;
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.client!.send(command);
      return true;
    } catch (error) {
      this.logger.warn(`Failed to delete S3 object "${key}"`, error);
      return false;
    }
  }

  async getPublicUrl(
    key: string,
    expiresInSeconds?: number,
  ): Promise<string | null> {
    if (!key.trim()) {
      return null;
    }

    if (this.usesPublicUrls()) {
      return this.buildDirectUrl(key);
    }

    return this.getPresignedUrl(key, expiresInSeconds);
  }

  async getPresignedUrl(
    key: string,
    expiresInSeconds: number = this.presignedExpirySeconds,
  ): Promise<string | null> {
    this.assertConfigured();

    const expiresIn = Math.min(
      Math.max(expiresInSeconds, 60),
      PRESIGNED_EXPIRY_MAX_SECONDS,
    );

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return getSignedUrl(this.client!, command, { expiresIn });
  }

  private getExtractKeyOptions(): ExtractS3KeyOptions {
    return {
      bucketName: this.bucketName,
      endpoint: this.endpoint,
      publicBaseUrl: this.publicBaseUrl,
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

  private assertConfigured(): void {
    if (!this.isConfigured() || !this.client) {
      throw new Error('S3 is not configured');
    }
  }
}
