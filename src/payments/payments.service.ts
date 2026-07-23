import { Injectable } from '@nestjs/common';
import { PaidFor } from '../common/types/payment.types';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentFulfillmentService } from './payment-fulfillment.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly paymentFulfillmentService: PaymentFulfillmentService,
  ) {}

  verifyPayment(dto: VerifyPaymentDto, requestingStudentEmail: string) {
    const forcedPaidFor =
      dto.paidFor?.toLowerCase() === PaidFor.COURSE
        ? PaidFor.COURSE
        : dto.paidFor?.toLowerCase() === PaidFor.ONBOARDING
          ? PaidFor.ONBOARDING
          : undefined;

    return this.paymentFulfillmentService.verifyAndFulfill({
      transactionId: dto.transactionId,
      txRef: dto.txRef,
      source: 'api',
      requestingStudentEmail,
      forcedPaidFor,
      webhookMeta: {
        paidFor: dto.paidFor,
        courseId: dto.courseId,
        courseIds: dto.courseIds,
      },
    });
  }

  getOnboardingStatus(userId: string) {
    return this.paymentFulfillmentService.getOnboardingStatus(userId);
  }

  skipPhoneVerification(userId: string) {
    return this.paymentFulfillmentService.skipPhoneVerification(userId);
  }
}
