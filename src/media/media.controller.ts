import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../common/abac/guards/jwt-auth.guard';
import { SkipMustChangePasswordCheck } from '../common/abac/decorators/skip-must-change-password.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import {
  DeleteMediaQueryDto,
  MediaKeyQueryDto,
  PresignedMediaQueryDto,
  UploadMediaQueryDto,
} from './dto/media-query.dto';
import { UPLOAD_FOLDERS } from './media.config';
import { MediaUploadInterceptor } from './media-upload.interceptor';
import { S3Service } from './s3.service';

/**
 * Nest port of Fileam `mediaUploadController` + `mediaRoutes`:
 * - GET  /media/view       public redirect to presigned GetObject URL
 * - GET  /media/presigned  auth JSON `{ url }`
 * - POST /media/upload     auth multipart → `{ url, key }` (url = view proxy)
 * - DELETE /media          auth delete by key
 */
@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(private readonly s3Service: S3Service) {}

  @ApiBearerAuth()
  @SkipMustChangePasswordCheck()
  @UseGuards(JwtAuthGuard)
  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        folder: {
          type: 'string',
          enum: Object.values(UPLOAD_FOLDERS),
        },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(MediaUploadInterceptor)
  @ResponseMessage('File uploaded')
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query() query: UploadMediaQueryDto,
    @Req() req: Request,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException(
        "No file provided. Send multipart form with field 'file'.",
      );
    }

    const allowed = this.s3Service.getAllowedFileTypes();
    const mimetype = file.mimetype || 'application/octet-stream';

    if (!(allowed as readonly string[]).includes(mimetype)) {
      throw new BadRequestException(
        `File type not allowed. Allowed: ${allowed.join(', ')}`,
      );
    }

    const maxBytes = this.s3Service.getMaxFileSizeBytes();
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `File too large. Max size: ${maxBytes / 1024 / 1024}MB`,
      );
    }

    const folder =
      query.folder ??
      (typeof req.body?.folder === 'string' ? req.body.folder : undefined);

    const result = await this.s3Service.upload({
      buffer: file.buffer,
      mimetype,
      originalName: file.originalname || 'file',
      folder,
    });

    if (!result) {
      throw new InternalServerErrorException(
        'Upload failed. S3 may not be configured.',
      );
    }

    // Fileam returns the API view proxy URL, not the raw S3 URL.
    const origin = `${req.protocol}://${req.get('host') ?? ''}`;
    const apiPrefix = req.originalUrl.split('/media')[0] ?? '';
    const url = `${origin}${apiPrefix}/media/view?key=${encodeURIComponent(result.key)}`;

    return {
      url,
      key: result.key,
    };
  }

  /** Public — Fileam `viewMedia`: always 302 to a GetObject presigned URL. */
  @Get('view')
  async view(
    @Query() query: MediaKeyQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const key = query.key?.trim();
    if (!key) {
      throw new BadRequestException("Query parameter 'key' is required");
    }

    const expiresIn =
      query.expiresIn ?? this.s3Service.getDefaultPresignedExpirySeconds();

    const url = await this.s3Service.getPresignedUrl(key, expiresIn);
    if (!url) {
      throw new InternalServerErrorException('Failed to generate media URL');
    }

    res.redirect(302, url);
    return undefined;
  }

  /** Auth — Fileam `getPresignedUrlForView`: JSON `{ url }`. */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('presigned')
  @ResponseMessage('OK')
  async getPresigned(@Query() query: PresignedMediaQueryDto) {
    const key = query.key?.trim();
    if (!key) {
      throw new BadRequestException("Query parameter 'key' is required");
    }

    const max = this.s3Service.getPresignedExpiryMaxSeconds();
    const expiresIn =
      query.expiresIn ?? this.s3Service.getDefaultPresignedExpirySeconds();

    if (expiresIn < 60 || expiresIn > max) {
      throw new BadRequestException(
        `expiresIn must be a number between 60 and ${max}`,
      );
    }

    const url = await this.s3Service.getPresignedUrl(key, expiresIn);
    if (!url) {
      throw new InternalServerErrorException('Failed to generate media URL');
    }

    return { url };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete()
  @ResponseMessage('File deleted')
  async deleteMedia(@Query() query: DeleteMediaQueryDto) {
    const key = query.key?.trim();
    if (!key) {
      throw new BadRequestException("Query parameter 'key' is required");
    }

    const deleted = await this.s3Service.delete(key);
    if (!deleted) {
      throw new InternalServerErrorException(
        'Failed to delete file. S3 may not be configured or key may not exist.',
      );
    }

    return null;
  }
}
