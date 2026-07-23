import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  FlutterwaveVerifyData,
  PaidFor,
  PaymentPlatform,
} from '../common/types/payment.types';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import {
  mergePaymentMetadata,
  needsCourseIds,
  parsePaymentMetadata,
  resolvePaidForFromSources,
} from './utils/payment.util';
import { FlutterwaveService } from './flutterwave.service';
import { PaymentDebugLogger } from './payment-debug.logger';
import { PaymentFulfillmentService } from './payment-fulfillment.service';

export interface PaymentSyncItemResult {
  externalTransactionId: string;
  txRef: string | null;
  paidFor: PaidFor | null;
  status: 'synced' | 'recorded' | 'skipped' | 'failed';
  reason?: string;
  result?: Record<string, unknown>;
}

export interface PaymentSyncSummary {
  days: number;
  from: string;
  to: string;
  totalFetched: number;
  synced: number;
  recorded: number;
  skipped: number;
  failed: number;
  items: PaymentSyncItemResult[];
}

@Injectable()
export class PaymentSyncService {
  private static readonly DEFAULT_SYNC_DAYS = 3;
  private static readonly MAX_SYNC_DAYS = 30;
  private readonly logger = new Logger(PaymentSyncService.name);

  constructor(
    private readonly flutterwaveService: FlutterwaveService,
    private readonly paymentFulfillmentService: PaymentFulfillmentService,
    private readonly paymentDebugLogger: PaymentDebugLogger,
    @InjectRepository(PaymentTransaction)
    private readonly transactionsRepository: Repository<PaymentTransaction>,
  ) {}

  async syncRecentTransactions(
    days = PaymentSyncService.DEFAULT_SYNC_DAYS,
  ): Promise<PaymentSyncSummary> {
    const syncDays = Math.min(
      Math.max(days, 1),
      PaymentSyncService.MAX_SYNC_DAYS,
    );
    const to = this.formatDate(new Date());
    const from = this.formatDate(this.subtractDays(new Date(), syncDays));

    this.logger.log(
      `Starting Flutterwave sync for ${from} to ${to} (${syncDays} day(s))`,
    );
    await this.paymentDebugLogger.log('sync.start', { from, to, days: syncDays });

    const transactions = await this.flutterwaveService.fetchAllTransactions(
      from,
      to,
    );

    this.logger.log(`Processing ${transactions.length} transaction(s)`);

    const items: PaymentSyncItemResult[] = [];

    for (const [index, transaction] of transactions.entries()) {
      this.logger.log(
        `Syncing transaction ${index + 1}/${transactions.length}: ${transaction.id}`,
      );
      items.push(await this.syncTransaction(transaction));
    }

    const summary: PaymentSyncSummary = {
      days: syncDays,
      from,
      to,
      totalFetched: transactions.length,
      synced: items.filter((item) => item.status === 'synced').length,
      recorded: items.filter((item) => item.status === 'recorded').length,
      skipped: items.filter((item) => item.status === 'skipped').length,
      failed: items.filter((item) => item.status === 'failed').length,
      items,
    };

    this.logger.log(
      `Flutterwave sync complete: synced=${summary.synced}, recorded=${summary.recorded}, skipped=${summary.skipped}, failed=${summary.failed}`,
    );

    await this.paymentDebugLogger.log('sync.complete', {
      ...summary,
    });

    return summary;
  }

  private async syncTransaction(
    listRow: FlutterwaveVerifyData,
  ): Promise<PaymentSyncItemResult> {
    const transaction = await this.hydrateTransaction(listRow);
    const metadata = parsePaymentMetadata(transaction.meta);
    const paidFor = resolvePaidForFromSources({
      metadataPaidFor: metadata.paidFor,
      txRef: transaction.tx_ref,
    });
    const base = {
      externalTransactionId: String(transaction.id),
      txRef: transaction.tx_ref || null,
      paidFor,
    };

    if (!this.flutterwaveService.isSuccessfulPayment(transaction)) {
      if (!paidFor) {
        return {
          ...base,
          status: 'skipped',
          reason:
            'Failed Flutterwave payment has no paidFor onboarding/course metadata',
        };
      }

      try {
        await this.paymentFulfillmentService.recordFailedPayment({
          flutterwaveData: transaction,
          webhookMeta: {
            ...metadata,
            ...(paidFor ? { paidFor } : {}),
          },
          source: 'sync',
          failureReason: `Flutterwave payment status: ${transaction.status}`,
        });

        return {
          ...base,
          status: 'recorded',
          reason: `Recorded failed payment (${transaction.status})`,
        };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return {
          ...base,
          status: 'failed',
          reason: `Could not record failed payment: ${reason}`,
        };
      }
    }

    if (!paidFor) {
      return {
        ...base,
        status: 'skipped',
        reason:
          'Transaction metadata has no paidFor onboarding/course value (and tx_ref prefix is unknown)',
      };
    }

    const existing = await this.transactionsRepository.findOne({
      where: {
        paymentPlatform: PaymentPlatform.FLUTTERWAVE,
        externalTransactionId: String(transaction.id),
      },
    });

    if (existing?.fulfillmentCompleted) {
      return {
        ...base,
        status: 'skipped',
        reason: 'Transaction already fulfilled in database',
      };
    }

    if (paidFor === PaidFor.COURSE && needsCourseIds(metadata)) {
      return {
        ...base,
        status: 'failed',
        reason:
          'Course payment is missing courseId/courseIds in Flutterwave metadata — cannot enroll from sync alone',
      };
    }

    try {
      const result = await this.paymentFulfillmentService.verifyAndFulfill({
        flutterwaveData: {
          ...transaction,
          meta: {
            ...metadata,
            paidFor,
          },
        },
        source: 'sync',
        forcedPaidFor: paidFor,
        registrationFallback: {
          email: metadata.email,
          partnerId: metadata.partnerId,
          accessCode: metadata.accessCode,
          fullName: metadata.fullName,
          phone: metadata.phone,
        },
        webhookMeta: {
          ...metadata,
          paidFor,
        },
      });

      const resultRecord = result as Record<string, unknown>;

      if (resultRecord.alreadyFulfilled) {
        return {
          ...base,
          status: 'skipped',
          reason: 'Transaction already fulfilled',
          result: resultRecord,
        };
      }

      return {
        ...base,
        status: 'synced',
        result: resultRecord,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to sync transaction ${transaction.id}: ${reason}`,
      );

      return {
        ...base,
        status: 'failed',
        reason: `Payment succeeded on Flutterwave but processing failed: ${reason}`,
      };
    }
  }

  /**
   * List endpoints often omit meta. Re-verify by tx_ref (or id) when metadata
   * is incomplete so sync can fulfill the same way as webhook/verify.
   */
  private async hydrateTransaction(
    listRow: FlutterwaveVerifyData,
  ): Promise<FlutterwaveVerifyData> {
    const listMeta = parsePaymentMetadata(listRow.meta);
    const paidFor = resolvePaidForFromSources({
      metadataPaidFor: listMeta.paidFor,
      txRef: listRow.tx_ref,
    });
    const incomplete =
      !paidFor ||
      (paidFor === PaidFor.COURSE && needsCourseIds(listMeta)) ||
      (!listMeta.email && !listMeta.userId);

    if (!incomplete) {
      return {
        ...listRow,
        meta: mergePaymentMetadata(listMeta, { paidFor: paidFor ?? undefined }),
      };
    }

    try {
      const verified = listRow.tx_ref
        ? await this.flutterwaveService.verifyByReference(listRow.tx_ref)
        : await this.flutterwaveService.verifyByTransactionId(listRow.id);

      const verifiedMeta = mergePaymentMetadata(
        parsePaymentMetadata(listRow.meta),
        parsePaymentMetadata(verified.meta),
      );
      const resolvedPaidFor = resolvePaidForFromSources({
        metadataPaidFor: verifiedMeta.paidFor,
        txRef: verified.tx_ref || listRow.tx_ref,
      });

      return {
        ...listRow,
        ...verified,
        tx_ref: verified.tx_ref || listRow.tx_ref,
        meta: {
          ...verifiedMeta,
          ...(resolvedPaidFor ? { paidFor: resolvedPaidFor } : {}),
        },
      };
    } catch (error) {
      this.logger.warn(
        `Could not re-verify transaction ${listRow.id} during sync: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return {
        ...listRow,
        meta: {
          ...listMeta,
          ...(paidFor ? { paidFor } : {}),
        },
      };
    }
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private subtractDays(date: Date, days: number): Date {
    const copy = new Date(date);
    copy.setDate(copy.getDate() - days);
    return copy;
  }
}
