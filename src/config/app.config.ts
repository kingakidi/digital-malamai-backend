import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT!, 10),
  apiPrefix: process.env.API_PREFIX!,
  swaggerPath: process.env.SWAGGER_PATH!,
}));
