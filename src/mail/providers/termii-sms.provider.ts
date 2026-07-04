import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { toTermiiRecipient } from '../utils/phone.util';

@Injectable()
export class TermiiSmsProvider {
  private readonly logger = new Logger(TermiiSmsProvider.name);

  constructor(private readonly configService: ConfigService) {}

  isEnabled(): boolean {
    return this.configService.get<boolean>('messaging.smsEnabled') === true;
  }

  isConfigured(): boolean {
    const { apiKey, senderId } = this.configService.get('messaging.termii')!;
    return Boolean(apiKey && senderId);
  }

  async sendTextMessage(phone: string, body: string): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.debug('SMS sending is disabled — Termii message skipped');
      return;
    }

    const { apiKey, senderId, baseUrl } =
      this.configService.get('messaging.termii')!;

    if (!this.isConfigured()) {
      this.logger.warn('Termii SMS is not configured — message skipped');
      return;
    }

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/sms/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        to: toTermiiRecipient(phone),
        from: senderId,
        sms: body,
        type: 'plain',
        channel: 'generic',
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(`Termii SMS failed (${response.status}): ${errorBody}`);
      throw new Error('Termii SMS delivery failed');
    }
  }
}
