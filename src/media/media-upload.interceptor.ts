import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import * as multer from 'multer';
import type { Request, Response } from 'express';
import { S3Service } from './s3.service';

@Injectable()
export class MediaUploadInterceptor implements NestInterceptor {
  constructor(private readonly s3Service: S3Service) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const maxBytes = this.s3Service.getMaxFileSizeBytes();

    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: maxBytes },
    }).single('file');

    return new Promise((resolve, reject) => {
      upload(req, res, (error: unknown) => {
        if (error) {
          if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            (error as { code?: string }).code === 'LIMIT_FILE_SIZE'
          ) {
            reject(
              new PayloadTooLargeException(
                `File too large. Max size: ${maxBytes / 1024 / 1024}MB`,
              ),
            );
            return;
          }

          if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            (error as { code?: string }).code === 'LIMIT_UNEXPECTED_FILE'
          ) {
            reject(
              new BadRequestException(
                "Unexpected field. Use form field name 'file'.",
              ),
            );
            return;
          }

          reject(error);
          return;
        }
        resolve(next.handle());
      });
    });
  }
}
