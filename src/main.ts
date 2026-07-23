import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Express } from 'express';
import { AppModule } from './app.module';
import { isCorsOriginAllowed } from './config/cors.util';
import { WelcomeService } from './welcome/welcome.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const apiPrefix = configService.get<string>('app.apiPrefix')!;
  const swaggerPath = configService.get<string>('app.swaggerPath')!;
  const port = configService.get<number>('app.port')!;
  const corsOrigins = configService.get<string[]>('app.corsOrigins') ?? [];
  const isDev = process.env.NODE_ENV !== 'production';

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      const allowed = isCorsOriginAllowed(origin, corsOrigins, {
        allowLocalDev: isDev,
      });
      callback(null, allowed);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.setGlobalPrefix(apiPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const welcomeService = app.get(WelcomeService);
  const expressApp = app.getHttpAdapter().getInstance() as Express;
  expressApp.get('/', (_req, res) => {
    res.type('text/plain').send(welcomeService.getText());
  });

  const swaggerConfig = new DocumentBuilder()
    .addBearerAuth()
    .setTitle('Digital Malamai API')
    .setDescription(
      'Digital Malamai API.\n\n' +
        '**Success envelope:** `{ status: true, message: string, data: T }`\n\n' +
        '**Error envelope:** `{ status: false, message: string, error: string | string[] }`\n\n' +
        'Paginated `data` shape: `{ data: T[], meta: { page, limit, total, totalPages, hasNextPage, hasPreviousPage } }`',
    )
    .setVersion('1.0')
    .addServer(`/${apiPrefix}`, 'Version 1')
    .addTag('auth')
    .addTag('users')
    .addTag('admin/users')
    .addTag('roles')
    .addTag('partners')
    .addTag('admin/partners')
    .addTag('partners/access-codes')
    .addTag('admin/access-codes')
    .addTag('students')
    .addTag('courses')
    .addTag('admin/courses')
    .addTag('courses/videos')
    .addTag('admin/reports')
    .addTag('partners/portal')
    .addTag('auth/otp')
    .addTag('media')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(swaggerPath, app, document);

  await app.listen(port);
}
bootstrap();
