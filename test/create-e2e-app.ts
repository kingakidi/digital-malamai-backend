import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import type { Express } from 'express';
import { AppModule } from '../src/app.module';
import { WelcomeService } from '../src/welcome/welcome.service';

export async function createE2eApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  const configService = app.get(ConfigService);
  const apiPrefix = configService.get<string>('app.apiPrefix') ?? 'api/v1';
  const welcomeService = app.get(WelcomeService);

  app.setGlobalPrefix(apiPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const expressApp = app.getHttpAdapter().getInstance() as Express;
  expressApp.get('/', (_req, res) => {
    res.type('text/plain').send(welcomeService.getText());
  });

  await app.init();
  return app;
}
