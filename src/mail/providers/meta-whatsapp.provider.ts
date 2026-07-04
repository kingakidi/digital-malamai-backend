import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { toMetaWhatsAppRecipient } from '../utils/phone.util';
import { WhatsAppProviderAdapter } from './whatsapp-provider.interface';

@Injectable()
export class MetaWhatsAppProvider implements WhatsAppProviderAdapter {
  private readonly logger = new Logger(MetaWhatsAppProvider.name);

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    const { accessToken, phoneNumberId } =
      this.configService.get('messaging.meta')!;

    return Boolean(accessToken && phoneNumberId);
  }

  async sendTextMessage(phone: string, body: string): Promise<void> {
    const { accessToken, phoneNumberId, apiVersion } =
      this.configService.get('messaging.meta')!;

    if (!this.isConfigured()) {
      this.logger.warn('Meta WhatsApp is not configured — message skipped');
      return;
    }

    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: toMetaWhatsAppRecipient(phone),
          type: 'text',
          text: { body },
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(`Meta WhatsApp failed (${response.status}): ${errorBody}`);
      throw new Error('Meta WhatsApp delivery failed');
    }
  }
}
