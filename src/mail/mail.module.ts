import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailTemplateService } from './mail-template.service';
import { MetaWhatsAppProvider } from './providers/meta-whatsapp.provider';
import { TermiiSmsProvider } from './providers/termii-sms.provider';
import { TwilioWhatsAppProvider } from './providers/twilio-whatsapp.provider';
import { PhoneMessagingService } from './phone-messaging.service';

@Module({
  providers: [
    MailTemplateService,
    MailService,
    TwilioWhatsAppProvider,
    MetaWhatsAppProvider,
    TermiiSmsProvider,
    PhoneMessagingService,
  ],
  exports: [MailTemplateService, MailService, PhoneMessagingService],
})
export class MailModule {}
