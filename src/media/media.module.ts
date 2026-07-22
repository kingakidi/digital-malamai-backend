import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MediaController } from './media.controller';
import { MediaUploadInterceptor } from './media-upload.interceptor';
import { S3Service } from './s3.service';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [MediaController],
  providers: [S3Service, MediaUploadInterceptor],
  exports: [S3Service],
})
export class MediaModule {}
