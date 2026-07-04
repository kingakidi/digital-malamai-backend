import { Injectable } from '@nestjs/common';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentFulfillmentService } from './payment-fulfillment.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly paymentFulfillmentService: PaymentFulfillmentService,
  ) {}

  verifyPayment(dto: VerifyPaymentDto) {
    return this.paymentFulfillmentService.verifyAndFulfill({
      transactionId: dto.transactionId,
      txRef: dto.txRef,
      source: 'api',
    });
  }

  getOnboardingStatus(userId: string) {
    return this.paymentFulfillmentService.getOnboardingStatus(userId);
  }
}
