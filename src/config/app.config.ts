import { registerAs } from '@nestjs/config';
import { parseCorsOrigins } from './cors.util';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT!, 10),
  apiPrefix: process.env.API_PREFIX!,
  swaggerPath: process.env.SWAGGER_PATH!,
  debugRequestLogs: process.env.DEBUG_REQUEST_LOGS ?? '',
  partnerPortalLoginUrl: process.env.PARTNER_PORTAL_LOGIN_URL ?? '',
  staffPortalLoginUrl: process.env.STAFF_PORTAL_LOGIN_URL ?? '',
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
  paymentDebugLogs: process.env.PAYMENT_DEBUG_LOGS ?? 'false',
}));
