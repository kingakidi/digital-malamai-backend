import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { SystemSetting } from './entities/system-setting.entity';
import {
  AdminSettingsController,
  SettingsController,
} from './settings.controller';
import { SettingsSeedService } from './settings-seed.service';
import { SettingsService } from './settings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SystemSetting]),
    forwardRef(() => AuthModule),
  ],
  controllers: [SettingsController, AdminSettingsController],
  providers: [SettingsService, SettingsSeedService],
  exports: [SettingsService],
})
export class SettingsModule {}
