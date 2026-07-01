import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  swaggerPath: process.env.SWAGGER_PATH ?? 'api',
}));
