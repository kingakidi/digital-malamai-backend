import { Module } from '@nestjs/common';
import { ApiWelcomeController } from './welcome.controller';
import { WelcomeService } from './welcome.service';

@Module({
  controllers: [ApiWelcomeController],
  providers: [WelcomeService],
  exports: [WelcomeService],
})
export class WelcomeModule {}
