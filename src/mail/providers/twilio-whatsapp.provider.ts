import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { toTwilioWhatsAppAddress } from '../utils/phone.util';
import { WhatsAppProviderAdapter } from './whatsapp-provider.interface';

type TwilioConfig = {
  accountSid: string;
  authToken: string;
  whatsappFrom: string;
  messagingServiceSid: string;
  otpContentSid: string;
  messageContentSid: string;
};

@Injectable()
export class TwilioWhatsAppProvider implements WhatsAppProviderAdapter {
  private readonly logger = new Logger(TwilioWhatsAppProvider.name);

  constructor(private readonly configService: ConfigService) {}

  private getTwilioConfig(): TwilioConfig {
    return this.configService.get<TwilioConfig>('messaging.twilio')!;
  }

  isConfigured(): boolean {
    const { accountSid, authToken, whatsappFrom } = this.getTwilioConfig();
    return Boolean(accountSid && authToken && whatsappFrom);
  }

  hasOtpTemplate(): boolean {
    return Boolean(this.getTwilioConfig().otpContentSid);
  }

  hasMessageTemplate(): boolean {
    return Boolean(this.getTwilioConfig().messageContentSid);
  }

  async sendTextMessage(phone: string, body: string): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn('Twilio WhatsApp is not configured — message skipped');
      return;
    }

    await this.createMessage(phone, { Body: body });
  }

  async sendOtpTemplate(phone: string, otpCode: string): Promise<void> {
    const { otpContentSid } = this.getTwilioConfig();
    if (!otpContentSid) {
      throw new Error(
        'TWILIO_WHATSAPP_OTP_CONTENT_SID is not set — create an approved WhatsApp OTP Content Template in Twilio and add its HX SID to .env',
      );
    }

    await this.sendContentTemplate(phone, otpContentSid, { '1': otpCode });
  }

  async sendMessageTemplate(phone: string, message: string): Promise<void> {
    const { messageContentSid } = this.getTwilioConfig();
    if (!messageContentSid) {
      throw new Error(
        'TWILIO_WHATSAPP_MESSAGE_CONTENT_SID is not set — create an approved WhatsApp Content Template and add its HX SID to .env',
      );
    }

    await this.sendContentTemplate(phone, messageContentSid, { '1': message });
  }

  /**
   * Course delivery template must include static text + variables.
   * WhatsApp rejects bodies that are only {{1}}.
   * Expected body:
   *   Your Digital Malamai course "{{1}}" is ready.
   *
   *   {{2}}
   */
  async sendCourseDeliveryTemplate(
    phone: string,
    courseTitle: string,
    linksText: string,
  ): Promise<void> {
    const { messageContentSid } = this.getTwilioConfig();
    if (!messageContentSid) {
      throw new Error(
        'TWILIO_WHATSAPP_MESSAGE_CONTENT_SID is not set — create an approved WhatsApp Content Template and add its HX SID to .env',
      );
    }

    await this.sendContentTemplate(phone, messageContentSid, {
      '1': courseTitle,
      '2': linksText,
    });
  }

  async sendContentTemplate(
    phone: string,
    contentSid: string,
    variables: Record<string, string>,
  ): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn('Twilio WhatsApp is not configured — message skipped');
      return;
    }

    const params: Record<string, string> = {
      ContentSid: contentSid,
    };

    if (Object.keys(variables).length > 0) {
      params.ContentVariables = JSON.stringify(variables);
    }

    const { messagingServiceSid } = this.getTwilioConfig();
    if (messagingServiceSid) {
      params.MessagingServiceSid = messagingServiceSid;
    }

    await this.createMessage(phone, params);
  }

  private async createMessage(
    phone: string,
    extraParams: Record<string, string>,
  ): Promise<void> {
    const { accountSid, authToken, whatsappFrom } = this.getTwilioConfig();
    const from = whatsappFrom.startsWith('whatsapp:')
      ? whatsappFrom
      : `whatsapp:${whatsappFrom}`;

    const params = new URLSearchParams({
      From: from,
      To: toTwilioWhatsAppAddress(phone),
      ...extraParams,
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(`Twilio WhatsApp failed (${response.status}): ${errorBody}`);
      throw new Error('Twilio WhatsApp delivery failed');
    }
  }
}
