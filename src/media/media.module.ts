import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MediaController } from './media.controller';
import { S3Service } from './s3.service';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [MediaController],
  providers: [S3Service],
  exports: [S3Service],
})
export class MediaModule {}
