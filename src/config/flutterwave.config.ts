import { registerAs } from '@nestjs/config';

export default registerAs('flutterwave', () => ({
  secretKey: process.env.FLUTTERWAVE_SECRET_KEY ?? '',
  secretHash: process.env.FLUTTERWAVE_SECRET_HASH ?? '',
  baseUrl: process.env.FLUTTERWAVE_BASE_URL ?? 'https://api.flutterwave.com/v3',
  defaultCurrency: process.env.FLUTTERWAVE_DEFAULT_CURRENCY ?? 'NGN',
}));
