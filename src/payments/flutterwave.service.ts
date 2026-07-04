import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FlutterwaveVerifyData,
  FlutterwaveVerifyResponse,
} from '../common/types/payment.types';

@Injectable()
export class FlutterwaveService {
  constructor(private readonly configService: ConfigService) {}

  verifyWebhookSignature(signature: string | undefined): void {
    const secretHash = this.configService.get<string>('flutterwave.secretHash');

    if (!secretHash) {
      return;
    }

    if (!signature || signature !== secretHash) {
      throw new UnauthorizedException('Invalid Flutterwave webhook signature');
    }
  }

  async verifyByTransactionId(
    transactionId: string | number,
  ): Promise<FlutterwaveVerifyData> {
    const secretKey = this.getSecretKey();
    const baseUrl = this.configService.get<string>('flutterwave.baseUrl');

    const response = await fetch(
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

    return payload.data;
  }

  async verifyByReference(txRef: string): Promise<FlutterwaveVerifyData> {
    const secretKey = this.getSecretKey();
    const baseUrl = this.configService.get<string>('flutterwave.baseUrl');

    const response = await fetch(
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
        payload.message ?? 'Unable to verify Flutterwave transaction',
      );
    }

    return payload.data;
  }

  isSuccessfulPayment(data: FlutterwaveVerifyData): boolean {
    return data.status?.toLowerCase() === 'successful';
  }

  private getSecretKey(): string {
    const secretKey = this.configService.get<string>('flutterwave.secretKey');

    if (!secretKey) {
      throw new BadRequestException('Flutterwave secret key is not configured');
    }

    return secretKey;
  }
}
