import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsAppProvider } from '../common/types/messaging.types';
import { MailTemplateService } from './mail-template.service';
import { MetaWhatsAppProvider } from './providers/meta-whatsapp.provider';
import { TermiiSmsProvider } from './providers/termii-sms.provider';
import { TwilioWhatsAppProvider } from './providers/twilio-whatsapp.provider';

@Injectable()
export class PhoneMessagingService {
  private readonly logger = new Logger(PhoneMessagingService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly mailTemplateService: MailTemplateService,
    private readonly twilioWhatsAppProvider: TwilioWhatsAppProvider,
    private readonly metaWhatsAppProvider: MetaWhatsAppProvider,
    private readonly termiiSmsProvider: TermiiSmsProvider,
  ) {}

  async sendOtpMessage(
    phone: string,
    templateName: string,
    variables: Record<string, string>,
  ): Promise<void> {
    const { body } = this.mailTemplateService.render(templateName, variables);
    await this.sendMessage(phone, body);
  }

  async sendMessage(phone: string, body: string): Promise<void> {
    const trimmedBody = body.replace(/\s+/g, ' ').trim();
    const whatsappSent = await this.sendWhatsAppMessage(phone, trimmedBody);

    if (!whatsappSent) {
      this.logger.warn(
        `WhatsApp not sent to ${phone} — no configured provider credentials`,
      );
    }

    if (this.termiiSmsProvider.isEnabled()) {
      await this.termiiSmsProvider.sendTextMessage(phone, trimmedBody);
    }
  }

  private async sendWhatsAppMessage(
    phone: string,
    body: string,
  ): Promise<boolean> {
    const provider = this.configService.get<WhatsAppProvider>(
      'messaging.whatsappDefaultProvider',
    )!;

    const adapter =
      provider === WhatsAppProvider.META
        ? this.metaWhatsAppProvider
        : this.twilioWhatsAppProvider;

    if (!adapter.isConfigured()) {
      return false;
    }

    await adapter.sendTextMessage(phone, body);
    this.logger.log(
      `WhatsApp message sent via ${provider} to ${phone}`,
    );

    return true;
  }
}
