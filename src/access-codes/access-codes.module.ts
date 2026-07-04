import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PartnersModule } from '../partners/partners.module';
import { AccessCodeGeneratorService } from './access-code-generator.service';
import {
  AdminAccessCodesController,
  PartnerAccessCodesController,
} from './access-codes.controller';
import { AccessCodesService } from './access-codes.service';
import { AccessCode } from './entities/access-code.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AccessCode]),
    forwardRef(() => AuthModule),
    forwardRef(() => PartnersModule),
  ],
  controllers: [PartnerAccessCodesController, AdminAccessCodesController],
  providers: [AccessCodesService, AccessCodeGeneratorService],
  exports: [AccessCodesService],
})
export class AccessCodesModule {}
