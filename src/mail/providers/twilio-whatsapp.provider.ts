import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { toTwilioWhatsAppAddress } from '../utils/phone.util';
import { WhatsAppProviderAdapter } from './whatsapp-provider.interface';

@Injectable()
export class TwilioWhatsAppProvider implements WhatsAppProviderAdapter {
  private readonly logger = new Logger(TwilioWhatsAppProvider.name);

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    const { accountSid, authToken, whatsappFrom } =
      this.configService.get('messaging.twilio')!;

    return Boolean(accountSid && authToken && whatsappFrom);
  }

  async sendTextMessage(phone: string, body: string): Promise<void> {
    const { accountSid, authToken, whatsappFrom } =
      this.configService.get('messaging.twilio')!;

    if (!this.isConfigured()) {
      this.logger.warn('Twilio WhatsApp is not configured — message skipped');
      return;
    }

    const from = whatsappFrom.startsWith('whatsapp:')
      ? whatsappFrom
      : `whatsapp:${whatsappFrom}`;

    const params = new URLSearchParams({
      From: from,
      To: toTwilioWhatsAppAddress(phone),
      Body: body,
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
