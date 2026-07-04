import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SYSTEM_SETTING_KEYS,
  SystemSetting,
} from './entities/system-setting.entity';

@Injectable()
export class SettingsSeedService implements OnModuleInit {
  private readonly logger = new Logger(SettingsSeedService.name);

  constructor(
    @InjectRepository(SystemSetting)
    private readonly settingsRepository: Repository<SystemSetting>,
  ) {}

  async onModuleInit(): Promise<void> {
    const existing = await this.settingsRepository.findOneBy({
      key: SYSTEM_SETTING_KEYS.ONBOARDING_FEE,
    });

    if (existing) {
      return;
    }

    const defaultAmount = Number(process.env.DEFAULT_ONBOARDING_FEE ?? 10000);
    const currency = process.env.FLUTTERWAVE_DEFAULT_CURRENCY ?? 'NGN';

    await this.settingsRepository.save(
      this.settingsRepository.create({
        key: SYSTEM_SETTING_KEYS.ONBOARDING_FEE,
        amount: defaultAmount,
        currency,
      }),
    );

    this.logger.log(
      `Seeded default onboarding fee: ${currency} ${defaultAmount}`,
    );
  }
}
