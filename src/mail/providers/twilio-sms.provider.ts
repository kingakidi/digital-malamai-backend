import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { normalizeE164Phone } from '../utils/phone.util';

@Injectable()
export class TwilioSmsProvider {
  private readonly logger = new Logger(TwilioSmsProvider.name);

  constructor(private readonly configService: ConfigService) {}

  isEnabled(): boolean {
    return this.configService.get<boolean>('messaging.smsEnabled') === true;
  }

  isConfigured(): boolean {
    const { accountSid, authToken, smsFrom } =
      this.configService.get('messaging.twilio')!;

    return Boolean(accountSid && authToken && smsFrom);
  }

  async sendTextMessage(phone: string, body: string): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.debug('SMS sending is disabled — Twilio SMS skipped');
      return;
    }

    const { accountSid, authToken, smsFrom } =
      this.configService.get('messaging.twilio')!;

    if (!this.isConfigured()) {
      this.logger.warn('Twilio SMS is not configured — message skipped');
      return;
    }

    const params = new URLSearchParams({
      From: smsFrom,
      To: normalizeE164Phone(phone),
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
      this.logger.error(`Twilio SMS failed (${response.status}): ${errorBody}`);
      throw new Error('Twilio SMS delivery failed');
    }
  }
}
