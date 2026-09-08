import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AccountWelcomeService } from './account-welcome.service';
import { MailService } from './mail.service';
import { MailTemplateService } from './mail-template.service';
import { MetaWhatsAppProvider } from './providers/meta-whatsapp.provider';
import { TwilioSmsProvider } from './providers/twilio-sms.provider';
import { TwilioWhatsAppProvider } from './providers/twilio-whatsapp.provider';
import { PhoneMessagingService } from './phone-messaging.service';

@Module({
  imports: [NotificationsModule],
  providers: [
    MailTemplateService,
    MailService,
    AccountWelcomeService,
    TwilioWhatsAppProvider,
    TwilioSmsProvider,
    MetaWhatsAppProvider,
    PhoneMessagingService,
  ],
  exports: [
    MailTemplateService,
    MailService,
    AccountWelcomeService,
    PhoneMessagingService,
  ],
})
export class MailModule {}
