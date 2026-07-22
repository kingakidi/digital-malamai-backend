import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
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
  UploadMediaQueryDto,
} from './dto/media-query.dto';
import { MediaUploadInterceptor } from './media-upload.interceptor';
import { S3Service } from './s3.service';

@ApiTags('media')
@Controller('media')
export class MediaController {
  private readonly logger = new Logger(MediaController.name);

  private static readonly UPLOAD_UNAVAILABLE_MESSAGE =
    "We couldn't upload your file right now. Please try again in a moment.";

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
          enum: ['partners', 'media', 'images'],
        },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(MediaUploadInterceptor)
  @ResponseMessage('File uploaded successfully')
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

    const allowed = this.s3Service.getAllowedImageMimeTypes();
    const mimetype = file.mimetype || 'application/octet-stream';

    if (!allowed.includes(mimetype)) {
      throw new BadRequestException(
        `File type not allowed. Allowed: ${allowed.join(', ')}`,
      );
    }

    if (file.size > this.s3Service.getMaxImageSizeBytes()) {
      throw new BadRequestException(
        `File too large. Max size: ${this.s3Service.getMaxImageSizeBytes() / 1024 / 1024}MB`,
      );
    }

    const folder =
      query.folder ??
      (typeof req.body?.folder === 'string' ? req.body.folder : undefined);

    let result: { url: string; key: string };
    try {
      result = await this.s3Service.upload({
        buffer: file.buffer,
        mimetype,
        originalName: file.originalname || 'file',
        folder,
      });
    } catch (error) {
      // Log the real cause for operators (e.g. storage unreachable, missing
      // bucket, bad credentials) but never leak internals to the client.
      this.logger.error(
        'Media upload failed',
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(
        MediaController.UPLOAD_UNAVAILABLE_MESSAGE,
      );
    }

    const origin = `${req.protocol}://${req.get('host') ?? ''}`;
    const apiPrefix = req.originalUrl.split('/media')[0] ?? '';
    const viewUrl = `${origin}${apiPrefix}/media/view?key=${encodeURIComponent(result.key)}`;

    return {
      url: viewUrl,
      key: result.key,
      directUrl: result.url,
    };
  }

  @Get('view')
  async view(
    @Query() query: MediaKeyQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const key = query.key?.trim();
    if (!key) {
      throw new BadRequestException("Query parameter 'key' is required");
    }

    let url: string | null;
    try {
      url = await this.s3Service.getPublicUrl(key, query.expiresIn);
    } catch (error) {
      this.logger.error(
        `Failed to resolve media URL for key "${key}"`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(
        MediaController.UPLOAD_UNAVAILABLE_MESSAGE,
      );
    }

    if (!url) {
      throw new ServiceUnavailableException(
        MediaController.UPLOAD_UNAVAILABLE_MESSAGE,
      );
    }

    if (query.json) {
      return { url };
    }

    res.redirect(302, url);
    return undefined;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete()
  @ResponseMessage('File deleted successfully')
  async deleteMedia(@Query() query: DeleteMediaQueryDto) {
    const key = query.key?.trim();
    if (!key) {
      throw new BadRequestException("Query parameter 'key' is required");
    }

    const deleted = await this.s3Service.delete(key);
    if (!deleted) {
      // The S3 layer already logs the underlying reason; keep the client
      // message friendly and non-technical.
      throw new ServiceUnavailableException(
        "We couldn't remove that file right now. Please try again in a moment.",
      );
    }

    return null;
  }
}
