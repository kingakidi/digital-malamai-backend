import { registerAs } from '@nestjs/config';

export default registerAs('throttle', () => ({
  ttl: Number(process.env.THROTTLE_TTL_MS ?? 60_000),
  limit: Number(process.env.THROTTLE_LIMIT ?? 100),
  authLimit: Number(process.env.THROTTLE_AUTH_LIMIT ?? 20),
}));
