import { BadRequestException } from '@nestjs/common';
import { OnboardingStatus } from '../../common/types/onboarding-status.type';
import {
  CommissionType,
  PaidFor,
  PaymentMetadata,
} from '../../common/types/payment.types';
import { Partner } from '../../partners/entities/partner.entity';

export function parsePaymentMetadata(
  meta: PaymentMetadata | string | Record<string, unknown> | undefined,
): PaymentMetadata {
  if (!meta) {
    return {};
  }

  if (typeof meta === 'string') {
    try {
      return JSON.parse(meta) as PaymentMetadata;
    } catch {
      return {};
    }
  }

  return meta as PaymentMetadata;
}

export function normalizePaidFor(
  value?: string,
  fallback?: PaidFor,
): PaidFor {
  const normalized = value?.toLowerCase();

  if (normalized === PaidFor.COURSE) {
    return PaidFor.COURSE;
  }

  if (normalized === PaidFor.ONBOARDING) {
    return PaidFor.ONBOARDING;
  }

  if (fallback) {
    return fallback;
  }

  throw new BadRequestException('Invalid payment metadata: paidFor is required');
}

export function mergePaymentMetadata(
  ...sources: Array<PaymentMetadata | Record<string, unknown> | undefined>
): PaymentMetadata {
  const merged: PaymentMetadata = {};

  for (const source of sources) {
    const parsed = parsePaymentMetadata(source);
    Object.assign(merged, parsed);
  }

  return merged;
}

export function isOnboardingEligible(status: OnboardingStatus | null): boolean {
  return (
    status === OnboardingStatus.EMAIL_VERIFIED ||
    status === OnboardingStatus.PHONE_VERIFIED ||
    status === OnboardingStatus.VERIFIED
  );
}

export function calculatePartnerCut(amount: number, partner: Partner): number {
  const numericAmount = Number(amount);

  if (partner.commissionType && partner.commissionValue != null) {
    const value = Number(partner.commissionValue);

    if (partner.commissionType === CommissionType.PERCENTAGE) {
      return roundMoney((numericAmount * value) / 100);
    }

    return roundMoney(Math.min(value, numericAmount));
  }

  if (partner.onboardPercentage) {
    return roundMoney((numericAmount * Number(partner.onboardPercentage)) / 100);
  }

  return 0;
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function resolveCoursePrice(price: number, discount: number, isFree: boolean): number {
  if (isFree) {
    return 0;
  }

  const numericPrice = Number(price);
  const numericDiscount = Number(discount);
  return roundMoney(Math.max(numericPrice - numericDiscount, 0));
}
