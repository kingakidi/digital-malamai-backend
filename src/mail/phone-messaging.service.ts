import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsAppProvider } from '../common/types/messaging.types';
import { MailTemplateService } from './mail-template.service';
import { MetaWhatsAppProvider } from './providers/meta-whatsapp.provider';
import { TwilioSmsProvider } from './providers/twilio-sms.provider';
import { TwilioWhatsAppProvider } from './providers/twilio-whatsapp.provider';

@Injectable()
export class PhoneMessagingService {
  private readonly logger = new Logger(PhoneMessagingService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly mailTemplateService: MailTemplateService,
    private readonly twilioWhatsAppProvider: TwilioWhatsAppProvider,
    private readonly metaWhatsAppProvider: MetaWhatsAppProvider,
    private readonly twilioSmsProvider: TwilioSmsProvider,
  ) {}

  async sendOtpMessage(
    phone: string,
    templateName: string,
    variables: Record<string, string>,
  ): Promise<void> {
    const { body } = this.mailTemplateService.render(templateName, variables);
    const trimmedBody = body.replace(/\s+/g, ' ').trim();
    const otpCode = variables.otp?.trim();

    const whatsappSent = await this.sendWhatsAppOtp(phone, otpCode, trimmedBody);

    let smsSent = false;
    if (this.twilioSmsProvider.isEnabled()) {
      await this.twilioSmsProvider.sendTextMessage(phone, trimmedBody);
      smsSent = true;
    }

    if (!whatsappSent && !smsSent) {
      throw new Error(
        'Unable to deliver OTP — WhatsApp is not configured or delivery failed',
      );
    }
  }

  async sendMessage(phone: string, body: string): Promise<void> {
    const trimmedBody = body.replace(/\s+/g, ' ').trim();
    const whatsappSent = await this.sendWhatsAppTransactional(phone, trimmedBody);

    if (!whatsappSent) {
      this.logger.warn(
        `WhatsApp not sent to ${phone} — no configured provider credentials`,
      );
    }

    if (this.twilioSmsProvider.isEnabled()) {
      await this.twilioSmsProvider.sendTextMessage(phone, trimmedBody);
    }
  }

  async sendCourseAccessMessage(
    phone: string,
    courseTitle: string,
    linksText: string,
  ): Promise<void> {
    const title = courseTitle.trim();
    const links =
      linksText.trim() ||
      'Check your email for video links.';
    const fallbackBody = `Your course "${title}" is ready.\n\n${links}`;

    const whatsappSent = await this.sendWhatsAppCourseAccess(
      phone,
      title,
      links,
      fallbackBody,
    );

    if (!whatsappSent) {
      this.logger.warn(
        `WhatsApp course links not sent to ${phone} — no configured provider credentials`,
      );
    }

    if (this.twilioSmsProvider.isEnabled()) {
      await this.twilioSmsProvider.sendTextMessage(phone, fallbackBody);
    }
  }

  private getDefaultProvider(): WhatsAppProvider {
    return this.configService.get<WhatsAppProvider>(
      'messaging.whatsappDefaultProvider',
    )!;
  }

  private async sendWhatsAppOtp(
    phone: string,
    otpCode: string | undefined,
    fallbackBody: string,
  ): Promise<boolean> {
    const provider = this.getDefaultProvider();

    if (provider === WhatsAppProvider.TWILIO) {
      if (!this.twilioWhatsAppProvider.isConfigured()) {
        return false;
      }

      if (this.twilioWhatsAppProvider.hasOtpTemplate() && otpCode) {
        await this.twilioWhatsAppProvider.sendOtpTemplate(phone, otpCode);
        this.logger.log(`WhatsApp OTP template sent via twilio to ${phone}`);
        return true;
      }

      this.logger.warn(
        'TWILIO_WHATSAPP_OTP_CONTENT_SID is not set — falling back to free-form WhatsApp (will fail outside the 24h window with error 63016)',
      );
      await this.twilioWhatsAppProvider.sendTextMessage(phone, fallbackBody);
      this.logger.log(`WhatsApp free-form OTP sent via twilio to ${phone}`);
      return true;
    }

    if (!this.metaWhatsAppProvider.isConfigured()) {
      return false;
    }

    await this.metaWhatsAppProvider.sendTextMessage(phone, fallbackBody);
    this.logger.log(`WhatsApp message sent via meta to ${phone}`);
    return true;
  }

  private async sendWhatsAppCourseAccess(
    phone: string,
    courseTitle: string,
    linksText: string,
    fallbackBody: string,
  ): Promise<boolean> {
    const provider = this.getDefaultProvider();

    if (provider === WhatsAppProvider.TWILIO) {
      if (!this.twilioWhatsAppProvider.isConfigured()) {
        return false;
      }

      if (this.twilioWhatsAppProvider.hasMessageTemplate()) {
        await this.twilioWhatsAppProvider.sendCourseDeliveryTemplate(
          phone,
          courseTitle,
          linksText,
        );
        this.logger.log(
          `WhatsApp course template sent via twilio to ${phone}`,
        );
        return true;
      }

      this.logger.warn(
        'TWILIO_WHATSAPP_MESSAGE_CONTENT_SID is not set — falling back to free-form WhatsApp (will fail outside the 24h window with error 63016)',
      );
      await this.twilioWhatsAppProvider.sendTextMessage(phone, fallbackBody);
      this.logger.log(`WhatsApp free-form course message sent via twilio to ${phone}`);
      return true;
    }

    if (!this.metaWhatsAppProvider.isConfigured()) {
      return false;
    }

    await this.metaWhatsAppProvider.sendTextMessage(phone, fallbackBody);
    this.logger.log(`WhatsApp course message sent via meta to ${phone}`);
    return true;
  }

  private async sendWhatsAppTransactional(
    phone: string,
    body: string,
  ): Promise<boolean> {
    const provider = this.getDefaultProvider();

    if (provider === WhatsAppProvider.TWILIO) {
      if (!this.twilioWhatsAppProvider.isConfigured()) {
        return false;
      }

      if (this.twilioWhatsAppProvider.hasMessageTemplate()) {
        await this.twilioWhatsAppProvider.sendMessageTemplate(phone, body);
        this.logger.log(`WhatsApp message template sent via twilio to ${phone}`);
        return true;
      }

      this.logger.warn(
        'TWILIO_WHATSAPP_MESSAGE_CONTENT_SID is not set — falling back to free-form WhatsApp (will fail outside the 24h window with error 63016)',
      );
      await this.twilioWhatsAppProvider.sendTextMessage(phone, body);
      this.logger.log(`WhatsApp free-form message sent via twilio to ${phone}`);
      return true;
    }

    if (!this.metaWhatsAppProvider.isConfigured()) {
      return false;
    }

    await this.metaWhatsAppProvider.sendTextMessage(phone, body);
    this.logger.log(`WhatsApp message sent via meta to ${phone}`);
    return true;
  }
}
