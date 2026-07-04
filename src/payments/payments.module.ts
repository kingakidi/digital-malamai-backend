import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoursesModule } from '../courses/courses.module';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PartnersModule } from '../partners/partners.module';
import { SettingsModule } from '../settings/settings.module';
import { UserModule } from '../user/user.module';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { FlutterwaveService } from './flutterwave.service';
import { OnboardingController } from './onboarding.controller';
import { PaymentFulfillmentService } from './payment-fulfillment.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentTransaction]),
    UserModule,
    PartnersModule,
    SettingsModule,
    CoursesModule,
    MailModule,
    NotificationsModule,
  ],
  controllers: [PaymentsController, WebhooksController, OnboardingController],
  providers: [FlutterwaveService, PaymentFulfillmentService, PaymentsService],
  exports: [PaymentsService, PaymentFulfillmentService],
})
export class PaymentsModule {}
