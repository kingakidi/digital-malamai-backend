import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnboardingStatus } from '../common/types/onboarding-status.type';
import {
  FlutterwaveVerifyData,
  PaidFor,
  PaymentPlatform,
} from '../common/types/payment.types';
import { RoleName } from '../common/types/permission.types';
import { CoursesService } from '../courses/courses.service';
import { UserService } from '../user/user.service';
import { CheckPaymentEligibilityDto } from './dto/check-payment-eligibility.dto';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { FlutterwaveService } from './flutterwave.service';
import { parsePaymentMetadata } from './utils/payment.util';

export interface PaymentEligibilityResult {
  eligible: boolean;
  alreadyPaid: boolean;
  paidFor: PaidFor;
  email: string;
  partnerId: string | null;
  courseId: string | null;
  source: 'database' | 'flutterwave' | null;
  message: string;
  matchedTransactionId: string | null;
}

@Injectable()
export class PaymentEligibilityService {
  private static readonly FLUTTERWAVE_LOOKBACK_DAYS = 30;
  private readonly logger = new Logger(PaymentEligibilityService.name);

  constructor(
    private readonly userService: UserService,
    private readonly coursesService: CoursesService,
    private readonly flutterwaveService: FlutterwaveService,
    @InjectRepository(PaymentTransaction)
    private readonly transactionsRepository: Repository<PaymentTransaction>,
  ) {}

  async checkEligibility(
    dto: CheckPaymentEligibilityDto,
  ): Promise<PaymentEligibilityResult> {
    const email = dto.email.trim().toLowerCase();
    this.assertRequiredScope(dto);

    const base = {
      paidFor: dto.paidFor,
      email,
      partnerId: dto.partnerId ?? null,
      courseId: dto.courseId ?? null,
      source: null as PaymentEligibilityResult['source'],
      matchedTransactionId: null as string | null,
    };

    const databaseMatch = await this.checkDatabase(email, dto);
    if (databaseMatch) {
      return {
        ...base,
        eligible: false,
        alreadyPaid: true,
        source: 'database',
        matchedTransactionId: databaseMatch.transactionId,
        message: this.buildAlreadyPaidMessage(dto),
      };
    }

    const flutterwaveMatch = await this.checkFlutterwave(email, dto);
    if (flutterwaveMatch) {
      return {
        ...base,
        eligible: false,
        alreadyPaid: true,
        source: 'flutterwave',
        matchedTransactionId: String(flutterwaveMatch.id),
        message: this.buildAlreadyPaidMessage(dto),
      };
    }

    return {
      ...base,
      eligible: true,
      alreadyPaid: false,
      message: 'No existing payment found for this email and service',
    };
  }

  private assertRequiredScope(dto: CheckPaymentEligibilityDto): void {
    if (dto.paidFor === PaidFor.COURSE && !dto.courseId) {
      throw new BadRequestException(
        'courseId is required when paidFor is course',
      );
    }
  }

  private async checkDatabase(
    email: string,
    dto: CheckPaymentEligibilityDto,
  ): Promise<{ transactionId: string | null } | null> {
    const user = await this.userService.findByEmail(email);

    if (dto.paidFor === PaidFor.ONBOARDING) {
      if (
        user &&
        user.role.name === RoleName.STUDENT &&
        user.onboardingStatus === OnboardingStatus.ONBOARDED &&
        (!dto.partnerId || user.partnerId === dto.partnerId)
      ) {
        const latest = await this.findFulfilledTransaction({
          paidFor: PaidFor.ONBOARDING,
          partnerId: dto.partnerId,
          userId: user.id,
        });

        return {
          transactionId: latest?.externalTransactionId ?? null,
        };
      }

      if (user) {
        const latest = await this.findFulfilledTransaction({
          paidFor: PaidFor.ONBOARDING,
          partnerId: dto.partnerId,
          userId: user.id,
        });

        if (latest) {
          return { transactionId: latest.externalTransactionId };
        }
      }

      return null;
    }

    if (!user || user.role.name !== RoleName.STUDENT) {
      return null;
    }

    const enrollment = await this.coursesService.findEnrollment(
      user.id,
      dto.courseId!,
    );

    if (enrollment) {
      const latest = await this.findFulfilledTransaction({
        paidFor: PaidFor.COURSE,
        courseId: dto.courseId!,
        userId: user.id,
      });

      return {
        transactionId: latest?.externalTransactionId ?? null,
      };
    }

    const latest = await this.findFulfilledTransaction({
      paidFor: PaidFor.COURSE,
      courseId: dto.courseId!,
      userId: user.id,
    });

    return latest ? { transactionId: latest.externalTransactionId } : null;
  }

  private async findFulfilledTransaction(input: {
    paidFor: PaidFor;
    partnerId?: string;
    courseId?: string;
    userId: string;
  }): Promise<PaymentTransaction | null> {
    const qb = this.transactionsRepository
      .createQueryBuilder('tx')
      .where('tx.paymentPlatform = :platform', {
        platform: PaymentPlatform.FLUTTERWAVE,
      })
      .andWhere('tx.paidFor = :paidFor', { paidFor: input.paidFor })
      .andWhere('tx.userId = :userId', { userId: input.userId })
      .andWhere('tx.fulfillmentCompleted = :fulfilled', { fulfilled: true });

    if (input.partnerId) {
      qb.andWhere('tx.partnerId = :partnerId', { partnerId: input.partnerId });
    }

    if (input.courseId) {
      qb.andWhere('tx.courseId = :courseId', { courseId: input.courseId });
    }

    return qb.orderBy('tx.createdAt', 'DESC').getOne();
  }

  private async checkFlutterwave(
    email: string,
    dto: CheckPaymentEligibilityDto,
  ): Promise<FlutterwaveVerifyData | null> {
    const to = this.formatDate(new Date());
    const from = this.formatDate(
      this.subtractDays(new Date(), PaymentEligibilityService.FLUTTERWAVE_LOOKBACK_DAYS),
    );

    this.logger.log(
      `Checking Flutterwave payments for ${email} (${dto.paidFor}) from ${from} to ${to}`,
    );

    const transactions = await this.flutterwaveService.fetchAllSuccessfulTransactions(
      from,
      to,
    );

    for (const transaction of transactions) {
      if (!this.transactionMatches(email, dto, transaction)) {
        continue;
      }

      const existing = await this.transactionsRepository.findOne({
        where: {
          paymentPlatform: PaymentPlatform.FLUTTERWAVE,
          externalTransactionId: String(transaction.id),
          fulfillmentCompleted: true,
        },
      });

      if (existing) {
        continue;
      }

      return transaction;
    }

    return null;
  }

  private transactionMatches(
    email: string,
    dto: CheckPaymentEligibilityDto,
    transaction: FlutterwaveVerifyData,
  ): boolean {
    const metadata = parsePaymentMetadata(transaction.meta);
    const transactionEmail = (
      metadata.email ??
      transaction.customer?.email
    )?.toLowerCase();

    if (transactionEmail !== email) {
      return false;
    }

    const paidFor = metadata.paidFor?.toLowerCase();
    if (paidFor !== dto.paidFor) {
      return false;
    }

    if (dto.paidFor === PaidFor.ONBOARDING) {
      if (dto.partnerId) {
        return metadata.partnerId === dto.partnerId;
      }
      return true;
    }

    return metadata.courseId === dto.courseId;
  }

  private buildAlreadyPaidMessage(dto: CheckPaymentEligibilityDto): string {
    if (dto.paidFor === PaidFor.ONBOARDING) {
      return dto.partnerId
        ? 'This email has already completed onboarding payment for the selected partner'
        : 'This email has already completed onboarding payment';
    }

    return 'This email has already paid for the selected course';
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
