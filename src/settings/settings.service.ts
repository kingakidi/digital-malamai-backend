import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SYSTEM_SETTING_KEYS,
  SystemSetting,
} from './entities/system-setting.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(SystemSetting)
    private readonly settingsRepository: Repository<SystemSetting>,
  ) {}

  async getOnboardingFee(): Promise<SystemSetting> {
    const setting = await this.settingsRepository.findOneBy({
      key: SYSTEM_SETTING_KEYS.ONBOARDING_FEE,
    });

    if (!setting) {
      throw new NotFoundException('System onboarding fee is not configured');
    }

    return setting;
  }

  async getOnboardingFeeAmount(): Promise<number> {
    const setting = await this.getOnboardingFee();
    return Number(setting.amount);
  }

  async setOnboardingFee(amount: number, currency = 'NGN'): Promise<SystemSetting> {
    let setting = await this.settingsRepository.findOneBy({
      key: SYSTEM_SETTING_KEYS.ONBOARDING_FEE,
    });

    if (!setting) {
      setting = this.settingsRepository.create({
        key: SYSTEM_SETTING_KEYS.ONBOARDING_FEE,
        amount,
        currency,
      });
    } else {
      setting.amount = amount;
      setting.currency = currency;
    }

    return this.settingsRepository.save(setting);
  }

  async resolveOnboardingFeeForPartner(partnerFee: number | null): Promise<number> {
    if (partnerFee != null) {
      return Number(partnerFee);
    }

    return this.getOnboardingFeeAmount();
  }
}
