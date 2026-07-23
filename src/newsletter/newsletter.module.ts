import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { NewsletterSubscriber } from './entities/newsletter-subscriber.entity';
import {
  AdminNewsletterController,
  NewsletterController,
} from './newsletter.controller';
import { NewsletterService } from './newsletter.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([NewsletterSubscriber]),
    forwardRef(() => AuthModule),
  ],
  controllers: [NewsletterController, AdminNewsletterController],
  providers: [NewsletterService],
  exports: [NewsletterService],
})
export class NewsletterModule {}
