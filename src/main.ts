import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .addBearerAuth()
    .setTitle('Digital Malamai API')
    .setDescription('NestJS API with ABAC authorization')
    .setVersion('1.0')
    .addTag('auth')
    .addTag('users')
    .addTag('roles')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(
    configService.get<string>('app.swaggerPath') ?? 'api',
    app,
    document,
  );

  const port = configService.get<number>('app.port') ?? 3000;
  await app.listen(port);
}
bootstrap();
