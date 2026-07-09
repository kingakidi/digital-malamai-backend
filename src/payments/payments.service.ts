import { Injectable } from '@nestjs/common';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentFulfillmentService } from './payment-fulfillment.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly paymentFulfillmentService: PaymentFulfillmentService,
  ) {}

  verifyPayment(dto: VerifyPaymentDto, requestingStudentEmail: string) {
    return this.paymentFulfillmentService.verifyAndFulfill({
      transactionId: dto.transactionId,
      txRef: dto.txRef,
      source: 'api',
      requestingStudentEmail,
    });
  }

  getOnboardingStatus(userId: string) {
    return this.paymentFulfillmentService.getOnboardingStatus(userId);
  }

  skipPhoneVerification(userId: string) {
    return this.paymentFulfillmentService.skipPhoneVerification(userId);
  }
}
