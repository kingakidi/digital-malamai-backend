import { registerAs } from '@nestjs/config';
import { WhatsAppProvider } from '../common/types/messaging.types';

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === '') {
    return defaultValue;
  }

  return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function parseWhatsAppProvider(value: string | undefined): WhatsAppProvider {
  const normalized = (value ?? WhatsAppProvider.TWILIO).trim().toLowerCase();

  if (normalized === WhatsAppProvider.META) {
    return WhatsAppProvider.META;
  }

  return WhatsAppProvider.TWILIO;
}

export default registerAs('messaging', () => ({
  whatsappDefaultProvider: parseWhatsAppProvider(
    process.env.WHATSAPP_DEFAULT_PROVIDER,
  ),
  smsEnabled: parseBoolean(process.env.SMS_ENABLED, false),
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    whatsappFrom: process.env.TWILIO_WHATSAPP_FROM ?? '',
  },
  meta: {
    accessToken: process.env.META_WHATSAPP_ACCESS_TOKEN ?? '',
    phoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID ?? '',
    apiVersion: process.env.META_WHATSAPP_API_VERSION ?? 'v21.0',
  },
  termii: {
    apiKey: process.env.TERMII_API_KEY ?? '',
    senderId: process.env.TERMII_SENDER_ID ?? '',
    baseUrl: process.env.TERMII_BASE_URL ?? 'https://api.ng.termii.com/api',
  },
}));
