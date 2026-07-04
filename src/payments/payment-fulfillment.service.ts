import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OnboardingStatus } from '../common/types/onboarding-status.type';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '../common/types/notification.types';
import {
  FlutterwaveVerifyData,
  PaidFor,
  PaymentPlatform,
  PaymentStatus,
} from '../common/types/payment.types';
import { RoleName } from '../common/types/permission.types';
import { CourseEnrollment } from '../courses/entities/course-enrollment.entity';
import { CoursesService } from '../courses/courses.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PhoneMessagingService } from '../mail/phone-messaging.service';
import { Partner } from '../partners/entities/partner.entity';
import { PartnersService } from '../partners/partners.service';
import { SettingsService } from '../settings/settings.service';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { FlutterwaveService } from './flutterwave.service';
import {
  calculatePartnerCut,
  isOnboardingEligible,
  normalizePaidFor,
  parsePaymentMetadata,
  roundMoney,
} from './utils/payment.util';

export interface VerifyPaymentInput {
  transactionId?: string;
  txRef?: string;
  source: 'api' | 'webhook';
}

@Injectable()
export class PaymentFulfillmentService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly flutterwaveService: FlutterwaveService,
    private readonly userService: UserService,
    private readonly partnersService: PartnersService,
    private readonly settingsService: SettingsService,
    private readonly coursesService: CoursesService,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
    private readonly phoneMessagingService: PhoneMessagingService,
    @InjectRepository(PaymentTransaction)
    private readonly transactionsRepository: Repository<PaymentTransaction>,
  ) {}

  async verifyAndFulfill(input: VerifyPaymentInput) {
    const flutterwaveData = await this.resolveFlutterwaveData(input);

    if (!this.flutterwaveService.isSuccessfulPayment(flutterwaveData)) {
      throw new BadRequestException('Payment was not successful');
    }

    const existing = await this.transactionsRepository.findOne({
      where: {
        paymentPlatform: PaymentPlatform.FLUTTERWAVE,
        externalTransactionId: String(flutterwaveData.id),
      },
      relations: ['user', 'course'],
    });

    if (existing?.fulfillmentCompleted) {
      return this.serializeTransaction(existing);
    }

    const parsedMetadata = parsePaymentMetadata(flutterwaveData.meta);
    const paidFor = normalizePaidFor(parsedMetadata.paidFor);
    const email = (
      parsedMetadata.email ?? flutterwaveData.customer?.email
    )?.toLowerCase();

    if (!email) {
      throw new BadRequestException(
        'Payment metadata must include email to link the transaction',
      );
    }

    const user = await this.userService.findByEmail(email);

    if (!user || user.role.name !== RoleName.STUDENT) {
      throw new NotFoundException('Student account not found for payment email');
    }

    if (paidFor === PaidFor.ONBOARDING) {
      return this.fulfillOnboarding(
        user,
        flutterwaveData,
        parsedMetadata as Record<string, unknown>,
        input.source,
        existing,
      );
    }

    return this.fulfillCourse(
      user,
      flutterwaveData,
      parsedMetadata as Record<string, unknown>,
      input.source,
      existing,
    );
  }

  async getOnboardingStatus(userId: string) {
    const user = await this.userService.findByIdWithRole(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const latestOnboardingPayment = await this.transactionsRepository.findOne({
      where: { userId, paidFor: PaidFor.ONBOARDING, status: PaymentStatus.SUCCESS },
      order: { createdAt: 'DESC' },
    });

    const expectedFee = user.partnerId
      ? await this.settingsService.resolveOnboardingFeeForPartner(
          (await this.partnersService.findOneEntity(user.partnerId)).onboardingFee,
        )
      : await this.settingsService.getOnboardingFeeAmount();

    return {
      onboardingStatus: user.onboardingStatus,
      emailVerifiedAt: user.emailVerifiedAt,
      phoneVerifiedAt: user.phoneVerifiedAt,
      expectedOnboardingFee: expectedFee,
      latestOnboardingPayment: latestOnboardingPayment
        ? this.serializeTransaction(latestOnboardingPayment)
        : null,
    };
  }

  private async fulfillOnboarding(
    user: User,
    flutterwaveData: FlutterwaveVerifyData,
    metadata: Record<string, unknown>,
    source: 'api' | 'webhook',
    existing: PaymentTransaction | null,
  ) {
    if (!isOnboardingEligible(user.onboardingStatus)) {
      throw new BadRequestException(
        'Student must verify email or phone before onboarding payment',
      );
    }

    if (!user.partnerId) {
      throw new BadRequestException('Student is not linked to a partner');
    }

    const partner = await this.partnersService.findOneEntity(user.partnerId);
    const expectedAmount = await this.settingsService.resolveOnboardingFeeForPartner(
      partner.onboardingFee,
    );
    const paidAmount = Number(flutterwaveData.amount);

    if (paidAmount + 0.001 < expectedAmount) {
      throw new BadRequestException(
        `Paid amount ${paidAmount} is less than expected onboarding fee ${expectedAmount}`,
      );
    }

    const partnerCut = calculatePartnerCut(paidAmount, partner);
    const platformCut = roundMoney(paidAmount - partnerCut);

    return this.dataSource.transaction(async (manager) => {
      const transaction = await this.saveTransaction(manager, {
        existing,
        flutterwaveData,
        paidFor: PaidFor.ONBOARDING,
        user,
        partner,
        courseId: null,
        partnerCut,
        platformCut,
        metadata,
        source,
      });

      if (transaction.fulfillmentCompleted) {
        return this.serializeTransaction(transaction);
      }

      user.onboardingStatus = OnboardingStatus.ONBOARDED;
      await manager.save(user);

      transaction.fulfillmentCompleted = true;
      await manager.save(transaction);

      await this.sendOnboardingReceipt(user, transaction);

      return this.serializeTransaction(transaction);
    });
  }

  private async fulfillCourse(
    user: User,
    flutterwaveData: FlutterwaveVerifyData,
    metadata: Record<string, unknown>,
    source: 'api' | 'webhook',
    existing: PaymentTransaction | null,
  ) {
    if (user.onboardingStatus !== OnboardingStatus.ONBOARDED) {
      throw new BadRequestException('Student must complete onboarding before purchasing courses');
    }

    const courseId = metadata.courseId as string | undefined;

    if (!courseId) {
      throw new BadRequestException('Payment metadata must include courseId for course payments');
    }

    const course = await this.coursesService.findPublishedCourse(courseId);
    const existingEnrollment = await this.coursesService.findEnrollment(
      user.id,
      course.id,
    );

    if (existingEnrollment && !existing) {
      throw new ConflictException('You are already enrolled in this course');
    }

    const expectedAmount = this.coursesService.getExpectedCourseAmount(course);
    const paidAmount = Number(flutterwaveData.amount);

    if (paidAmount + 0.001 < expectedAmount) {
      throw new BadRequestException(
        `Paid amount ${paidAmount} is less than expected course price ${expectedAmount}`,
      );
    }

    const partner = course.partnerId
      ? await this.partnersService.findOneEntity(course.partnerId)
      : null;

    return this.dataSource.transaction(async (manager) => {
      const transaction = await this.saveTransaction(manager, {
        existing,
        flutterwaveData,
        paidFor: PaidFor.COURSE,
        user,
        partner,
        courseId: course.id,
        partnerCut: 0,
        platformCut: paidAmount,
        metadata,
        source,
      });

      if (transaction.fulfillmentCompleted) {
        return {
          ...this.serializeTransaction(transaction),
          enrollmentId: existingEnrollment?.id ?? null,
        };
      }

      let enrollment = existingEnrollment;

      if (!enrollment) {
        enrollment = manager.create(CourseEnrollment, {
          userId: user.id,
          courseId: course.id,
          paymentTransactionId: transaction.id,
          enrolledAt: new Date(),
          paymentStatus: PaymentStatus.SUCCESS,
          unlockedAt: new Date(),
        });
        await manager.save(enrollment);
      }

      transaction.fulfillmentCompleted = true;
      await manager.save(transaction);

      if (!existingEnrollment?.unlockedAt) {
        await this.deliverCourseAccess(user, course.id, course.title);
      }

      return {
        ...this.serializeTransaction(transaction),
        enrollmentId: enrollment.id,
      };
    });
  }

  private async saveTransaction(
    manager: DataSource['manager'],
    input: {
      existing: PaymentTransaction | null;
      flutterwaveData: FlutterwaveVerifyData;
      paidFor: PaidFor;
      user: User;
      partner: Partner | null;
      courseId: string | null;
      partnerCut: number;
      platformCut: number;
      metadata: Record<string, unknown>;
      source: 'api' | 'webhook';
    },
  ): Promise<PaymentTransaction> {
    const fees = roundMoney(
      Number(input.flutterwaveData.app_fee ?? 0) +
        Number(input.flutterwaveData.merchant_fee ?? 0),
    );

    const payload = input.existing ?? manager.create(PaymentTransaction, {
      paymentPlatform: PaymentPlatform.FLUTTERWAVE,
      externalTransactionId: String(input.flutterwaveData.id),
    });

    payload.txRef = input.flutterwaveData.tx_ref ?? null;
    payload.flwRef = input.flutterwaveData.flw_ref ?? null;
    payload.paidFor = input.paidFor;
    payload.userId = input.user.id;
    payload.partnerId = input.partner?.id ?? input.user.partnerId ?? null;
    payload.courseId = input.courseId;
    payload.amount = Number(input.flutterwaveData.amount);
    payload.fees = fees;
    payload.partnerCut = input.partnerCut;
    payload.platformCut = input.platformCut;
    payload.currency = input.flutterwaveData.currency;
    payload.status = PaymentStatus.SUCCESS;
    payload.metadata = {
      ...input.metadata,
      flutterwave: input.flutterwaveData,
    };
    payload.verifiedAt = new Date();

    if (input.source === 'webhook') {
      payload.webhookVerified = true;
    } else {
      payload.apiVerified = true;
    }

    return manager.save(payload);
  }

  private async resolveFlutterwaveData(
    input: VerifyPaymentInput,
  ): Promise<FlutterwaveVerifyData> {
    if (input.transactionId) {
      return this.flutterwaveService.verifyByTransactionId(input.transactionId);
    }

    if (input.txRef) {
      return this.flutterwaveService.verifyByReference(input.txRef);
    }

    throw new BadRequestException('transactionId or txRef is required');
  }

  private async sendOnboardingReceipt(user: User, transaction: PaymentTransaction) {
    try {
      await this.mailService.sendTemplateMail(user.email, 'onboarding-receipt', {
        firstName: user.firstName,
        currency: transaction.currency,
        amount: String(transaction.amount),
      });
      await this.notificationsService.log({
        userId: user.id,
        channel: NotificationChannel.EMAIL,
        type: NotificationType.ONBOARDING_RECEIPT,
        payload: { transactionId: transaction.id, amount: transaction.amount },
        status: NotificationStatus.SENT,
        sentAt: new Date(),
      });
    } catch {
      await this.notificationsService.log({
        userId: user.id,
        channel: NotificationChannel.EMAIL,
        type: NotificationType.ONBOARDING_RECEIPT,
        payload: { transactionId: transaction.id },
        status: NotificationStatus.FAILED,
      });
    }
  }

  private async deliverCourseAccess(user: User, courseId: string, courseTitle: string) {
    const videos = await this.coursesService.getCourseVideos(courseId);
    const links = videos.map((video) => `${video.title}: ${video.vimeoUrl}`).join('\n');

    try {
      await this.mailService.sendTemplateMail(user.email, 'course-delivery', {
        firstName: user.firstName,
        courseTitle,
        links,
      });

      if (user.phone) {
        await this.phoneMessagingService.sendMessage(
          user.phone,
          `Your course "${courseTitle}" is ready. Check your email for video links.`,
        );
      }

      await this.notificationsService.log({
        userId: user.id,
        channel: NotificationChannel.EMAIL,
        type: NotificationType.COURSE_DELIVERY,
        payload: { courseId, videoCount: videos.length },
        status: NotificationStatus.SENT,
        sentAt: new Date(),
      });
    } catch {
      await this.notificationsService.log({
        userId: user.id,
        channel: NotificationChannel.EMAIL,
        type: NotificationType.COURSE_DELIVERY,
        payload: { courseId },
        status: NotificationStatus.FAILED,
      });
    }
  }

  private serializeTransaction(transaction: PaymentTransaction) {
    return {
      id: transaction.id,
      paymentPlatform: transaction.paymentPlatform,
      externalTransactionId: transaction.externalTransactionId,
      txRef: transaction.txRef,
      paidFor: transaction.paidFor,
      userId: transaction.userId,
      partnerId: transaction.partnerId,
      courseId: transaction.courseId,
      amount: Number(transaction.amount),
      fees: Number(transaction.fees),
      partnerCut: Number(transaction.partnerCut),
      platformCut: Number(transaction.platformCut),
      currency: transaction.currency,
      status: transaction.status,
      webhookVerified: transaction.webhookVerified,
      apiVerified: transaction.apiVerified,
      fulfillmentCompleted: transaction.fulfillmentCompleted,
      verifiedAt: transaction.verifiedAt,
      createdAt: transaction.createdAt,
    };
  }
}
