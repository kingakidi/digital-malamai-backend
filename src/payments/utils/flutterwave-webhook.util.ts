import {
  FlutterwaveVerifyData,
  PaymentMetadata,
} from '../../common/types/payment.types';
import { parsePaymentMetadata, mergePaymentMetadata } from './payment.util';

export interface ParsedFlutterwaveWebhook {
  webhookEventId: string;
  eventType: string;
  eventStatus: string;
  transactionId: string | null;
  txRef: string | null;
  amount: number | null;
  currency: string | null;
  meta: PaymentMetadata;
  customer: {
    email?: string;
    name?: string;
    phone_number?: string;
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function resolveEventStatus(data: Record<string, unknown>): string {
  if (data.status != null && String(data.status).trim() !== '') {
    return String(data.status);
  }

  const processor = data.processor_response;

  if (typeof processor === 'string' && processor.trim() !== '') {
    return processor;
  }

  if (processor && typeof processor === 'object') {
    const type = asRecord(processor).type;
    if (type != null && String(type).trim() !== '') {
      return String(type);
    }
  }

  return 'unknown';
}

export function parseFlutterwaveWebhookPayload(
  payload: Record<string, unknown>,
): ParsedFlutterwaveWebhook {
  const data = asRecord(payload.data);
  const customer = asRecord(data.customer);
  const meta = parsePaymentMetadata(
    (data.meta as PaymentMetadata | string | Record<string, unknown> | undefined) ??
      (payload.meta_data as
        | PaymentMetadata
        | string
        | Record<string, unknown>
        | undefined) ??
      (payload.meta as PaymentMetadata | string | Record<string, unknown> | undefined),
  );

  const eventType = String(payload.type ?? payload.event ?? 'unknown');
  const eventStatus = resolveEventStatus(data);

  const transactionId =
    data.id != null
      ? String(data.id)
      : data.transaction_id != null
        ? String(data.transaction_id)
        : null;

  const txRef =
    (data.reference as string | undefined) ??
    (data.tx_ref as string | undefined) ??
    null;

  const webhookEventId = String(
    payload.id ??
      `${eventType}:${transactionId ?? txRef ?? 'unknown'}:${eventStatus}`,
  );

  return {
    webhookEventId,
    eventType,
    eventStatus,
    transactionId,
    txRef,
    amount: data.amount != null ? Number(data.amount) : null,
    currency: (data.currency as string | undefined) ?? null,
    meta,
    customer: {
      email: customer.email as string | undefined,
      name: customer.name as string | undefined,
      phone_number:
        (customer.phone_number as string | undefined) ??
        (customer.phonenumber as string | undefined) ??
        (customer.phone as string | undefined),
    },
  };
}

export function buildFlutterwaveDataFromWebhook(
  payload: Record<string, unknown>,
  parsed: ParsedFlutterwaveWebhook,
): FlutterwaveVerifyData {
  const data = asRecord(payload.data);
  const meta = mergePaymentMetadata(
    parsed.meta,
    parsePaymentMetadata(
      (data.meta as PaymentMetadata | string | Record<string, unknown> | undefined) ??
        (payload.meta_data as
          | PaymentMetadata
          | string
          | Record<string, unknown>
          | undefined),
    ),
  );

  return {
    id: parsed.transactionId ?? parsed.txRef ?? 'unknown',
    tx_ref: parsed.txRef ?? '',
    flw_ref: (data.flw_ref as string | undefined) ?? undefined,
    amount: parsed.amount ?? Number(data.amount ?? data.charged_amount ?? 0),
    charged_amount:
      data.charged_amount != null ? Number(data.charged_amount) : undefined,
    currency: parsed.currency ?? String(data.currency ?? 'NGN'),
    status: parsed.eventStatus,
    app_fee: data.app_fee != null ? Number(data.app_fee) : undefined,
    merchant_fee:
      data.merchant_fee != null ? Number(data.merchant_fee) : undefined,
    meta,
    customer: parsed.customer,
  };
}

export function isSuccessfulWebhookStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return (
    normalized === 'successful' ||
    normalized === 'succeeded' ||
    normalized === 'approved' ||
    normalized === 'completed' ||
    normalized === '00'
  );
}

export function isWebhookFulfillmentComplete(
  result: Record<string, unknown> | null | undefined,
): boolean {
  if (!result) {
    return false;
  }

  return (
    result.fulfillmentCompleted === true || result.alreadyFulfilled === true
  );
}
