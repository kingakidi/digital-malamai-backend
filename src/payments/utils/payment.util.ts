import { BadRequestException } from '@nestjs/common';
import { OnboardingStatus } from '../../common/types/onboarding-status.type';
import {
  CommissionType,
  PaidFor,
  PaymentMetadata,
} from '../../common/types/payment.types';
import { Partner } from '../../partners/entities/partner.entity';

/**
 * Normalize Flutterwave meta into a flat PaymentMetadata object.
 * Supports JSON strings, plain objects, and FLW array form
 * `[{ metaname, metavalue }, ...]`.
 */
export function parsePaymentMetadata(
  meta: PaymentMetadata | string | Record<string, unknown> | unknown[] | undefined,
): PaymentMetadata {
  if (!meta) {
    return {};
  }

  let value: unknown = meta;

  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }

  if (Array.isArray(value)) {
    const fromArray: Record<string, unknown> = {};
    for (const entry of value) {
      if (!entry || typeof entry !== 'object') continue;
      const row = entry as Record<string, unknown>;
      const key = String(row.metaname ?? row.meta_name ?? row.name ?? '').trim();
      if (!key) continue;
      fromArray[key] = row.metavalue ?? row.meta_value ?? row.value;
    }
    return normalizeMetadataRecord(fromArray);
  }

  if (typeof value === 'object') {
    return normalizeMetadataRecord(value as Record<string, unknown>);
  }

  return {};
}

function normalizeMetadataRecord(
  record: Record<string, unknown>,
): PaymentMetadata {
  const result: PaymentMetadata = {};

  const assign = (key: keyof PaymentMetadata, raw: unknown) => {
    if (raw === undefined || raw === null || raw === '') return;
    result[key] = String(raw);
  };

  assign('paidFor', record.paidFor ?? record.paid_for);
  assign('email', record.email);
  assign('courseId', record.courseId ?? record.course_id);
  assign(
    'courseIds',
    record.courseIds ?? record.course_ids ?? record.courseIdList,
  );
  assign('partnerId', record.partnerId ?? record.partner_id);
  assign('accessCode', record.accessCode ?? record.access_code);
  assign('fullName', record.fullName ?? record.full_name ?? record.name);
  assign('phone', record.phone ?? record.phone_number ?? record.phonenumber);
  assign('userId', record.userId ?? record.user_id);

  // Nested custom fields sometimes appear under `custom_fields` / `__checkout_custom_fields`
  for (const nestedKey of ['custom_fields', '__checkout_custom_fields']) {
    const nested = record[nestedKey];
    if (nested) {
      Object.assign(result, parsePaymentMetadata(nested as never));
    }
  }

  return result;
}

/** Infer paidFor from our checkout tx_ref prefixes when Flutterwave meta is empty. */
export function inferPaidForFromTxRef(txRef?: string | null): PaidFor | null {
  if (!txRef) return null;
  const ref = txRef.toLowerCase();
  if (
    ref.startsWith('dm-cart-') ||
    ref.startsWith('dm-course-') ||
    ref.includes('-cart-') ||
    ref.includes('-course-')
  ) {
    return PaidFor.COURSE;
  }
  if (ref.startsWith('dm-onboard-') || ref.includes('-onboard-')) {
    return PaidFor.ONBOARDING;
  }
  return null;
}

export function tryResolvePaidFor(value?: string): PaidFor | null {
  const normalized = value?.toLowerCase();

  if (normalized === PaidFor.COURSE) {
    return PaidFor.COURSE;
  }

  if (normalized === PaidFor.ONBOARDING) {
    return PaidFor.ONBOARDING;
  }

  return null;
}

export function resolvePaidForFromSources(options: {
  metadataPaidFor?: string;
  txRef?: string | null;
  forcedPaidFor?: PaidFor;
}): PaidFor | null {
  return (
    tryResolvePaidFor(options.metadataPaidFor) ??
    options.forcedPaidFor ??
    inferPaidForFromTxRef(options.txRef) ??
    null
  );
}

export function normalizePaidFor(
  value?: string,
  fallback?: PaidFor,
): PaidFor {
  const resolved = resolvePaidForFromSources({
    metadataPaidFor: value,
    forcedPaidFor: fallback,
  });

  if (resolved) {
    return resolved;
  }

  throw new BadRequestException('Invalid payment metadata: paidFor is required');
}

export function mergePaymentMetadata(
  ...sources: Array<
    PaymentMetadata | string | Record<string, unknown> | unknown[] | undefined
  >
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

export function resolveCoursePrice(
  price: number,
  discount: number,
  isFree: boolean,
): number {
  if (isFree) {
    return 0;
  }

  const numericPrice = Number(price);
  const numericDiscount = Number(discount);
  return roundMoney(Math.max(numericPrice - numericDiscount, 0));
}

/** True when course fulfillment still needs courseId / courseIds. */
export function needsCourseIds(metadata: PaymentMetadata): boolean {
  const fromList =
    metadata.courseIds
      ?.split(',')
      .map((id) => id.trim())
      .filter(Boolean) ?? [];
  return fromList.length === 0 && !metadata.courseId;
}
