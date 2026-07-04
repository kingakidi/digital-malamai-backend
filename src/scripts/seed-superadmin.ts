import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SuperadminSeedService } from '../user/superadmin-seed.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const result = await app.get(SuperadminSeedService).seedIfMissing();

    if (result === 'created') {
      process.exitCode = 0;
      return;
    }

    if (result === 'skipped') {
      process.exitCode = 0;
      return;
    }

    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
