import { registerAs } from '@nestjs/config';

export default registerAs('otp', () => ({
  ttlMinutes: parseInt(process.env.OTP_TTL_MINUTES ?? '10', 10),
  hashSecret: process.env.OTP_HASH_SECRET ?? 'change-me-in-production',
}));
