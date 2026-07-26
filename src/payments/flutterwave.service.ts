import {
  BadRequestException,
  Injectable,
  Logger,
  RequestTimeoutException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FlutterwaveTransactionsListResponse,
  FlutterwaveVerifyData,
  FlutterwaveVerifyResponse,
} from '../common/types/payment.types';

@Injectable()
export class FlutterwaveService {
  private static readonly MAX_TRANSACTION_PAGES = 25;
  private readonly logger = new Logger(FlutterwaveService.name);

  constructor(private readonly configService: ConfigService) {}

  verifyWebhookSignature(
    signature: string | undefined,
    alternateSignature?: string | undefined,
  ): void {
    const secretHash = this.configService.get<string>('flutterwave.secretHash');

    if (!secretHash) {
      return;
    }

    const candidates = [signature, alternateSignature].filter(Boolean);

    if (!candidates.some((value) => value === secretHash)) {
      throw new UnauthorizedException('Invalid Flutterwave webhook signature');
    }
  }

  async verifyByTransactionId(
    transactionId: string | number,
  ): Promise<FlutterwaveVerifyData> {
    const id = String(transactionId);

    if (id.startsWith('chg_')) {
      return this.verifyCharge(id);
    }

    return this.verifyLegacyTransaction(id);
  }

  async verifyByReference(txRef: string): Promise<FlutterwaveVerifyData> {
    const payload = await this.fetchVerifyByReferenceRaw(txRef);
    return this.normalizeVerifyData(payload.data!);
  }

  async fetchRawVerifyResponse(input: {
    externalTransactionId?: string | null;
    txRef?: string | null;
  }): Promise<{
    lookup: 'transaction_id' | 'tx_ref' | 'charge_id';
    lookupValue: string;
    raw: unknown;
  }> {
    const externalId = input.externalTransactionId?.trim();
    const txRef = input.txRef?.trim();

    if (externalId) {
      if (externalId.startsWith('chg_')) {
        const raw = await this.fetchChargeRaw(externalId);
        return {
          lookup: 'charge_id',
          lookupValue: externalId,
          raw,
        };
      }

      const raw = await this.fetchVerifyByIdRaw(externalId);
      return {
        lookup: 'transaction_id',
        lookupValue: externalId,
        raw,
      };
    }

    if (txRef) {
      const raw = await this.fetchVerifyByReferenceRaw(txRef);
      return {
        lookup: 'tx_ref',
        lookupValue: txRef,
        raw,
      };
    }

    throw new BadRequestException(
      'Transaction has neither a Flutterwave transaction id nor a tx_ref',
    );
  }

  isSuccessfulPayment(data: FlutterwaveVerifyData): boolean {
    const status = data.status?.toLowerCase() ?? '';
    return (
      status === 'successful' ||
      status === 'succeeded' ||
      status === 'approved' ||
      status === 'completed' ||
      status === '00'
    );
  }

  async fetchAllSuccessfulTransactions(
    from: string,
    to: string,
  ): Promise<FlutterwaveVerifyData[]> {
    const all = await this.fetchAllTransactions(from, to);
    return all.filter((transaction) => this.isSuccessfulPayment(transaction));
  }

  async fetchAllTransactions(
    from: string,
    to: string,
  ): Promise<FlutterwaveVerifyData[]> {
    const fetchTimeoutMs =
      this.configService.get<number>('flutterwave.requestTimeoutMs') ?? 20000;
    const totalTimeoutMs = Math.max(fetchTimeoutMs * 3, 60000);

    return Promise.race([
      this.fetchAllTransactionsPages(from, to),
      new Promise<FlutterwaveVerifyData[]>((_, reject) => {
        setTimeout(() => {
          reject(
            new RequestTimeoutException(
              `Flutterwave transaction sync timed out after ${totalTimeoutMs}ms`,
            ),
          );
        }, totalTimeoutMs);
      }),
    ]);
  }

  private async fetchAllTransactionsPages(
    from: string,
    to: string,
  ): Promise<FlutterwaveVerifyData[]> {
    const transactions: FlutterwaveVerifyData[] = [];
    let page = 1;
    let totalPages = 1;

    while (
      page <= totalPages &&
      page <= FlutterwaveService.MAX_TRANSACTION_PAGES
    ) {
      this.logger.log(
        `Fetching Flutterwave transactions page ${page}/${totalPages} (${from} to ${to})`,
      );

      const response = await this.fetchTransactionsPage({ from, to, page });
      totalPages = Math.min(
        response.meta?.page_info?.total_pages ?? 1,
        FlutterwaveService.MAX_TRANSACTION_PAGES,
      );

      const pageItems = response.data ?? [];
      this.logger.log(
        `Flutterwave page ${page}: received ${pageItems.length} transaction(s)`,
      );

      for (const item of pageItems) {
        transactions.push(this.normalizeVerifyData(item));
      }

      if (pageItems.length === 0) {
        break;
      }

      page += 1;
    }

    this.logger.log(
      `Fetched ${transactions.length} Flutterwave transaction(s)`,
    );

    return transactions;
  }

  private async fetchTransactionsPage(input: {
    from: string;
    to: string;
    page: number;
  }): Promise<FlutterwaveTransactionsListResponse> {
    const secretKey = this.getSecretKey();
    const baseUrl = this.configService.get<string>('flutterwave.baseUrl');
    const params = new URLSearchParams({
      from: input.from,
      to: input.to,
      page: String(input.page),
    });

    const response = await this.fetchWithTimeout(
      `${baseUrl}/transactions?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const payload = (await response.json()) as FlutterwaveTransactionsListResponse;

    if (!response.ok || payload.status !== 'success') {
      throw new BadRequestException(
        payload.message ?? 'Unable to fetch Flutterwave transactions',
      );
    }

    return payload;
  }

  private async verifyLegacyTransaction(
    transactionId: string,
  ): Promise<FlutterwaveVerifyData> {
    const payload = await this.fetchVerifyByIdRaw(transactionId);
    return this.normalizeVerifyData(payload.data!);
  }

  private async fetchVerifyByIdRaw(
    transactionId: string,
  ): Promise<FlutterwaveVerifyResponse> {
    const secretKey = this.getSecretKey();
    const baseUrl = this.configService.get<string>('flutterwave.baseUrl');

    const response = await this.fetchWithTimeout(
      `${baseUrl}/transactions/${transactionId}/verify`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const payload = (await response.json()) as FlutterwaveVerifyResponse;

    if (!response.ok || payload.status !== 'success' || !payload.data) {
      throw new BadRequestException(
        payload.message ?? 'Unable to verify Flutterwave transaction',
      );
    }

    return payload;
  }

  private async fetchVerifyByReferenceRaw(
    txRef: string,
  ): Promise<FlutterwaveVerifyResponse> {
    const secretKey = this.getSecretKey();
    const baseUrl = this.configService.get<string>('flutterwave.baseUrl');

    const response = await this.fetchWithTimeout(
      `${baseUrl}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const payload = (await response.json()) as FlutterwaveVerifyResponse;

    if (!response.ok || payload.status !== 'success' || !payload.data) {
      throw new BadRequestException(
        payload.message ?? 'Unable to verify Flutterwave transaction by reference',
      );
    }

    return payload;
  }

  private async fetchChargeRaw(chargeId: string): Promise<{
    status: string;
    message: string;
    data?: Record<string, unknown>;
  }> {
    const secretKey = this.getSecretKey();
    const baseUrl = this.configService.get<string>('flutterwave.baseUrl');

    const response = await this.fetchWithTimeout(`${baseUrl}/charges/${chargeId}`, {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    });

    const payload = (await response.json()) as {
      status: string;
      message: string;
      data?: Record<string, unknown>;
    };

    if (!response.ok || payload.status !== 'success' || !payload.data) {
      throw new BadRequestException(
        payload.message ?? 'Unable to verify Flutterwave charge',
      );
    }

    return payload;
  }

  private async verifyCharge(chargeId: string): Promise<FlutterwaveVerifyData> {
    const payload = await this.fetchChargeRaw(chargeId);
    return this.normalizeVerifyData(
      this.chargeToVerifyData(chargeId, payload.data!),
    );
  }

  private chargeToVerifyData(
    chargeId: string,
    data: Record<string, unknown>,
  ): FlutterwaveVerifyData {
    const customer = (data.customer ?? {}) as Record<string, unknown>;

    return {
      id: String(data.id ?? chargeId),
      tx_ref: String(data.reference ?? data.tx_ref ?? ''),
      flw_ref: data.flw_ref as string | undefined,
      amount: Number(data.amount ?? 0),
      currency: String(data.currency ?? 'NGN'),
      status: String(data.status ?? ''),
      meta: data.meta as FlutterwaveVerifyData['meta'],
      customer: {
        email: customer.email as string | undefined,
        name: customer.name as string | undefined,
        phone_number:
          (customer.phone_number as string | undefined) ??
          (customer.phonenumber as string | undefined),
      },
    };
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const timeoutMs =
      this.configService.get<number>('flutterwave.requestTimeoutMs') ?? 20000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new RequestTimeoutException(
          `Flutterwave API request timed out after ${timeoutMs}ms`,
        );
      }

      throw new BadRequestException(
        error instanceof Error
          ? `Flutterwave API request failed: ${error.message}`
          : 'Flutterwave API request failed',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalizeVerifyData(data: FlutterwaveVerifyData): FlutterwaveVerifyData {
    const customer = data.customer ?? {};

    return {
      ...data,
      tx_ref: data.tx_ref ?? '',
      customer: {
        email: customer.email,
        name: customer.name,
        phone_number:
          customer.phone_number ?? customer.phonenumber,
      },
    };
  }

  private getSecretKey(): string {
    const secretKey = this.configService.get<string>('flutterwave.secretKey');

    if (!secretKey) {
      throw new BadRequestException('Flutterwave secret key is not configured');
    }

    return secretKey;
  }
}
