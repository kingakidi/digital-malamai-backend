import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CoursesModule } from '../courses/courses.module';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PartnersModule } from '../partners/partners.module';
import { SettingsModule } from '../settings/settings.module';
import { StudentsModule } from '../students/students.module';
import { UserModule } from '../user/user.module';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { PaymentWebhookEvent } from './entities/payment-webhook-event.entity';
import { FlutterwaveService } from './flutterwave.service';
import { OnboardingController } from './onboarding.controller';
import { PaymentDebugLogger } from './payment-debug.logger';
import { PaymentFulfillmentService } from './payment-fulfillment.service';
import { PaymentEligibilityService } from './payment-eligibility.service';
import { PaymentSyncService } from './payment-sync.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentTransaction, PaymentWebhookEvent]),
    forwardRef(() => AuthModule),
    UserModule,
    PartnersModule,
    SettingsModule,
    CoursesModule,
    MailModule,
    NotificationsModule,
    StudentsModule,
  ],
  controllers: [PaymentsController, WebhooksController, OnboardingController],
  providers: [
    FlutterwaveService,
    PaymentDebugLogger,
    PaymentFulfillmentService,
    PaymentEligibilityService,
    PaymentSyncService,
    PaymentsService,
  ],
  exports: [
    PaymentsService,
    PaymentFulfillmentService,
    PaymentEligibilityService,
    PaymentSyncService,
  ],
})
export class PaymentsModule {}
