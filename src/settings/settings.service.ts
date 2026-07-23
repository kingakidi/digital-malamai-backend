import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SYSTEM_SETTING_KEYS,
  SystemSetting,
} from './entities/system-setting.entity';

export type FlagSettingView = {
  key: string;
  enabled: boolean;
  updatedAt: Date;
};

export type CourseDeliverySettingsView = {
  watchInApp: boolean;
  email: true;
  whatsapp: boolean;
};

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
    if (partnerFee != null && Number(partnerFee) > 0) {
      return Number(partnerFee);
    }

    return this.getOnboardingFeeAmount();
  }

  getCourseLessonWatchInApp(): Promise<FlagSettingView> {
    return this.getFlagSetting(
      SYSTEM_SETTING_KEYS.COURSE_LESSON_WATCH_IN_APP,
      true,
    );
  }

  setCourseLessonWatchInApp(enabled: boolean): Promise<FlagSettingView> {
    return this.setFlagSetting(
      SYSTEM_SETTING_KEYS.COURSE_LESSON_WATCH_IN_APP,
      enabled,
      true,
    );
  }

  getCourseWhatsappDelivery(): Promise<FlagSettingView> {
    return this.getFlagSetting(
      SYSTEM_SETTING_KEYS.COURSE_WHATSAPP_DELIVERY,
      true,
    );
  }

  setCourseWhatsappDelivery(enabled: boolean): Promise<FlagSettingView> {
    return this.setFlagSetting(
      SYSTEM_SETTING_KEYS.COURSE_WHATSAPP_DELIVERY,
      enabled,
      true,
    );
  }

  async getCourseDeliverySettings(): Promise<CourseDeliverySettingsView> {
    const [watch, whatsapp] = await Promise.all([
      this.getCourseLessonWatchInApp(),
      this.getCourseWhatsappDelivery(),
    ]);

    return {
      watchInApp: watch.enabled,
      email: true,
      whatsapp: whatsapp.enabled,
    };
  }

  private async getFlagSetting(
    key: string,
    defaultEnabled: boolean,
  ): Promise<FlagSettingView> {
    const setting = await this.ensureFlagSetting(key, defaultEnabled);
    return {
      key: setting.key,
      enabled: Number(setting.amount) > 0,
      updatedAt: setting.updatedAt,
    };
  }

  private async setFlagSetting(
    key: string,
    enabled: boolean,
    defaultEnabled: boolean,
  ): Promise<FlagSettingView> {
    const setting = await this.ensureFlagSetting(key, defaultEnabled);
    setting.amount = enabled ? 1 : 0;
    const saved = await this.settingsRepository.save(setting);
    return {
      key: saved.key,
      enabled: Number(saved.amount) > 0,
      updatedAt: saved.updatedAt,
    };
  }

  private async ensureFlagSetting(
    key: string,
    defaultEnabled: boolean,
  ): Promise<SystemSetting> {
    let setting = await this.settingsRepository.findOneBy({ key });

    if (!setting) {
      setting = await this.settingsRepository.save(
        this.settingsRepository.create({
          key,
          amount: defaultEnabled ? 1 : 0,
          currency: 'FLG',
        }),
      );
    }

    return setting;
  }
}
