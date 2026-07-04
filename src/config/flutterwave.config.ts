import { registerAs } from '@nestjs/config';

export default registerAs('flutterwave', () => ({
  secretKey: process.env.FLUTTERWAVE_SECRET_KEY ?? '',
  secretHash: process.env.FLUTTERWAVE_SECRET_HASH ?? '',
  baseUrl: process.env.FLUTTERWAVE_BASE_URL ?? 'https://api.flutterwave.com/v3',
  defaultCurrency: process.env.FLUTTERWAVE_DEFAULT_CURRENCY ?? 'NGN',
  requestTimeoutMs: parseInt(process.env.FLUTTERWAVE_REQUEST_TIMEOUT_MS ?? '20000', 10),
}));
