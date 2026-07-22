import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
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
  PaymentMetadata,
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
import { StudentsService } from '../students/students.service';
import { OnboardingRegistrationInput } from '../students/types/onboarding-registration.type';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { PaymentWebhookEvent } from './entities/payment-webhook-event.entity';
import { FlutterwaveService } from './flutterwave.service';
import { PaymentDebugLogger } from './payment-debug.logger';
import {
  buildFlutterwaveDataFromWebhook,
  isSuccessfulWebhookStatus,
  isWebhookFulfillmentComplete,
  parseFlutterwaveWebhookPayload,
} from './utils/flutterwave-webhook.util';
import {
  calculatePartnerCut,
  mergePaymentMetadata,
  normalizePaidFor,
  parsePaymentMetadata,
  roundMoney,
  tryResolvePaidFor,
} from './utils/payment.util';

export interface VerifyPaymentInput {
  transactionId?: string;
  txRef?: string;
  flutterwaveData?: FlutterwaveVerifyData;
  source: 'api' | 'webhook' | 'sync';
  requestingStudentEmail?: string;
  forcedPaidFor?: PaidFor;
  registrationFallback?: Partial<OnboardingRegistrationInput>;
  webhookMeta?: PaymentMetadata;
}

@Injectable()
export class PaymentFulfillmentService {
  private readonly logger = new Logger(PaymentFulfillmentService.name);

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
    private readonly studentsService: StudentsService,
    private readonly paymentDebugLogger: PaymentDebugLogger,
    @InjectRepository(PaymentTransaction)
    private readonly transactionsRepository: Repository<PaymentTransaction>,
    @InjectRepository(PaymentWebhookEvent)
    private readonly webhookEventsRepository: Repository<PaymentWebhookEvent>,
  ) {}

  async verifyAndFulfill(input: VerifyPaymentInput) {
    await this.paymentDebugLogger.log('verify.request', {
      source: input.source,
      transactionId: input.transactionId ?? null,
      txRef: input.txRef ?? null,
      forcedPaidFor: input.forcedPaidFor ?? null,
      registrationFallback: input.registrationFallback ?? null,
      webhookMeta: input.webhookMeta ?? null,
    });

    try {
      const result = await this.processVerification(input);
      await this.paymentDebugLogger.log('verify.response', {
        source: input.source,
        success: true,
        result,
      });
      return result;
    } catch (error) {
      await this.paymentDebugLogger.log('verify.error', {
        source: input.source,
        transactionId: input.transactionId ?? null,
        txRef: input.txRef ?? null,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : String(error),
      });
      throw error;
    }
  }

  async handleWebhookPayload(payload: Record<string, unknown>) {
    const parsed = parseFlutterwaveWebhookPayload(payload);

    await this.paymentDebugLogger.logWebhook('webhook.request', {
      webhookEventId: parsed.webhookEventId,
      eventType: parsed.eventType,
      eventStatus: parsed.eventStatus,
      transactionId: parsed.transactionId,
      txRef: parsed.txRef,
      meta: parsed.meta,
      customer: parsed.customer,
      payload,
    });

    const existingEvent = await this.webhookEventsRepository.findOne({
      where: { webhookEventId: parsed.webhookEventId },
    });

    if (
      existingEvent?.processingResult &&
      isWebhookFulfillmentComplete(
        existingEvent.processingResult as Record<string, unknown>,
      )
    ) {
      await this.paymentDebugLogger.logWebhook('webhook.duplicate_skipped', {
        webhookEventId: parsed.webhookEventId,
        eventStatus: parsed.eventStatus,
        processingResult: existingEvent.processingResult,
      });
      return existingEvent.processingResult;
    }

    const webhookEvent =
      existingEvent ??
      this.webhookEventsRepository.create({
        webhookEventId: parsed.webhookEventId,
        eventType: parsed.eventType,
        eventStatus: parsed.eventStatus,
        externalTransactionId: parsed.transactionId,
        txRef: parsed.txRef,
        rawPayload: payload,
      });

    webhookEvent.eventStatus = parsed.eventStatus;
    webhookEvent.externalTransactionId = parsed.transactionId;
    webhookEvent.txRef = parsed.txRef;
    webhookEvent.rawPayload = payload;

    await this.webhookEventsRepository.save(webhookEvent);

    if (!isSuccessfulWebhookStatus(parsed.eventStatus)) {
      try {
        const flutterwaveData = buildFlutterwaveDataFromWebhook(payload, parsed);
        const recorded = await this.recordFailedPayment({
          flutterwaveData,
          webhookMeta: parsed.meta,
          registrationFallback: this.buildRegistrationFallback(
            parsed.meta,
            parsed.customer,
          ),
          source: 'webhook',
          failureReason: `Flutterwave payment status: ${parsed.eventStatus}`,
        });

        const result = {
          recorded: true,
          paymentFailed: true,
          transactionId: recorded.id,
          eventStatus: parsed.eventStatus,
        };
        webhookEvent.processingResult = result;
        await this.webhookEventsRepository.save(webhookEvent);
        await this.paymentDebugLogger.logWebhook('webhook.failed_recorded', result);
        this.logger.warn(
          `Recorded failed payment for webhook ${parsed.webhookEventId}: status=${parsed.eventStatus}`,
        );
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const skipped = {
          skipped: true,
          reason: `Could not record failed payment: ${message}`,
          eventStatus: parsed.eventStatus,
          eventType: parsed.eventType,
        };
        webhookEvent.processingResult = skipped;
        await this.webhookEventsRepository.save(webhookEvent);
        await this.paymentDebugLogger.logWebhook('webhook.skipped', skipped);
        this.logger.warn(
          `Webhook skipped for ${parsed.webhookEventId}: status=${parsed.eventStatus}, ${message}`,
        );
        return skipped;
      }
    }

    if (!parsed.transactionId && !parsed.txRef) {
      const error = {
        success: false,
        error: 'Webhook payload is missing transaction id or reference',
      };
      webhookEvent.processingResult = error;
      await this.webhookEventsRepository.save(webhookEvent);
      await this.paymentDebugLogger.logWebhook('webhook.error', error);
      throw new BadRequestException(error.error);
    }

    try {
      const flutterwaveData = buildFlutterwaveDataFromWebhook(payload, parsed);
      const registrationFallback = this.buildRegistrationFallback(
        parsed.meta,
        parsed.customer,
      );

      this.logger.log(
        `Fulfilling webhook ${parsed.webhookEventId} txRef=${parsed.txRef} transactionId=${parsed.transactionId}`,
      );

      const result = await this.verifyAndFulfill({
        flutterwaveData,
        txRef: parsed.txRef ?? undefined,
        transactionId:
          !parsed.txRef && parsed.transactionId
            ? parsed.transactionId
            : undefined,
        source: 'webhook',
        webhookMeta: parsed.meta,
        registrationFallback,
      });

      webhookEvent.processingResult = result as Record<string, unknown>;
      await this.webhookEventsRepository.save(webhookEvent);
      await this.paymentDebugLogger.logWebhook('webhook.response', {
        webhookEventId: parsed.webhookEventId,
        result,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      webhookEvent.processingResult = {
        success: false,
        error: message,
      };
      await this.webhookEventsRepository.save(webhookEvent);
      await this.paymentDebugLogger.logWebhook('webhook.error', {
        webhookEventId: parsed.webhookEventId,
        error: message,
        stack: error instanceof Error ? error.stack : undefined,
      });
      this.logger.error(
        `Webhook fulfillment failed for ${parsed.webhookEventId}: ${message}`,
      );
      throw error;
    }
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
      phoneVerificationSkippedAt: user.phoneVerificationSkippedAt,
      expectedOnboardingFee: expectedFee,
      latestOnboardingPayment: latestOnboardingPayment
        ? this.serializeTransaction(latestOnboardingPayment)
        : null,
    };
  }

  async skipPhoneVerification(userId: string) {
    const user = await this.userService.findByIdWithRole(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.phoneVerifiedAt) {
      throw new BadRequestException('Your phone is already verified');
    }

    const hasPaidOnboarding = await this.transactionsRepository.findOne({
      where: {
        userId,
        paidFor: PaidFor.ONBOARDING,
        status: PaymentStatus.SUCCESS,
      },
    });

    if (!hasPaidOnboarding) {
      throw new BadRequestException(
        'Complete the onboarding payment before skipping phone verification',
      );
    }

    user.phoneVerificationSkippedAt = new Date();
    // Paying the onboarding fee completes onboarding; phone verification is
    // optional, so record the skip and keep the student fully onboarded.
    user.onboardingStatus = OnboardingStatus.ONBOARDED;
    await this.userService.save(user);

    return {
      onboardingStatus: user.onboardingStatus,
      phoneVerifiedAt: user.phoneVerifiedAt,
      phoneVerificationSkippedAt: user.phoneVerificationSkippedAt,
    };
  }

  async recordFailedPayment(input: {
    flutterwaveData: FlutterwaveVerifyData;
    webhookMeta?: PaymentMetadata;
    registrationFallback?: Partial<OnboardingRegistrationInput>;
    source: 'webhook' | 'sync';
    failureReason: string;
  }): Promise<PaymentTransaction> {
    const metadata = mergePaymentMetadata(
      parsePaymentMetadata(input.flutterwaveData.meta),
      input.webhookMeta,
      input.registrationFallback,
    );

    const paidFor = tryResolvePaidFor(metadata.paidFor);

    if (!paidFor) {
      throw new BadRequestException(
        'Payment metadata must include paidFor onboarding/course to record a failed payment',
      );
    }

    const existing = await this.findExistingTransaction(input.flutterwaveData);

    if (
      existing &&
      existing.status === PaymentStatus.SUCCESS &&
      existing.fulfillmentCompleted
    ) {
      return existing;
    }

    const email = (
      metadata.email ??
      input.flutterwaveData.customer?.email ??
      input.registrationFallback?.email
    )?.toLowerCase();

    const user = email ? await this.userService.findByEmail(email) : null;
    const partnerId =
      metadata.partnerId ??
      input.registrationFallback?.partnerId ??
      user?.partnerId ??
      null;

    const fees = roundMoney(
      Number(input.flutterwaveData.app_fee ?? 0) +
        Number(input.flutterwaveData.merchant_fee ?? 0),
    );

    const payload =
      existing ??
      this.transactionsRepository.create({
        paymentPlatform: PaymentPlatform.FLUTTERWAVE,
        externalTransactionId: String(input.flutterwaveData.id),
      });

    payload.txRef = input.flutterwaveData.tx_ref || null;
    payload.flwRef = input.flutterwaveData.flw_ref ?? null;
    payload.paidFor = paidFor;
    payload.userId = user?.id ?? null;
    payload.partnerId = partnerId;
    payload.courseId = metadata.courseId ?? null;
    payload.amount = Number(input.flutterwaveData.amount);
    payload.fees = fees;
    payload.partnerCut = 0;
    payload.platformCut = 0;
    payload.currency = input.flutterwaveData.currency;
    payload.status = PaymentStatus.FAILED;
    payload.fulfillmentCompleted = false;
    payload.metadata = {
      ...metadata,
      failureReason: input.failureReason,
      flutterwaveStatus: input.flutterwaveData.status,
      flutterwave: input.flutterwaveData,
      payerEmail: email ?? null,
    };
    payload.verifiedAt = new Date();

    if (input.source === 'webhook') {
      payload.webhookVerified = true;
    } else {
      payload.apiVerified = true;
    }

    return this.transactionsRepository.save(payload);
  }

  private async processVerification(input: VerifyPaymentInput) {
    const flutterwaveData =
      input.flutterwaveData ?? (await this.resolveFlutterwaveData(input));

    await this.paymentDebugLogger.log('verify.flutterwave_data', {
      source: input.source,
      flutterwaveData,
    });

    if (!this.flutterwaveService.isSuccessfulPayment(flutterwaveData)) {
      throw new BadRequestException('Payment was not successful');
    }

    const existing = await this.findExistingTransaction(flutterwaveData);

    if (existing?.fulfillmentCompleted) {
      return {
        ...this.serializeTransaction(existing),
        alreadyFulfilled: true,
        studentAlreadyRegistered: true,
      };
    }

    const metadata = mergePaymentMetadata(
      parsePaymentMetadata(flutterwaveData.meta),
      input.webhookMeta,
      input.registrationFallback,
    );

    const paidFor = normalizePaidFor(metadata.paidFor, input.forcedPaidFor);

    const email = (
      metadata.email ??
      flutterwaveData.customer?.email ??
      input.registrationFallback?.email
    )?.toLowerCase();

    if (!email) {
      throw new BadRequestException(
        'Payment metadata must include email to link the transaction',
      );
    }

    let user = await this.userService.findByEmail(email);

    if (paidFor === PaidFor.ONBOARDING) {
      if (user && user.role.name !== RoleName.STUDENT) {
        throw new ConflictException(
          'Payment email is already registered to a non-student account',
        );
      }

      if (
        input.source === 'api' &&
        input.requestingStudentEmail &&
        user &&
        user.email.toLowerCase() !== input.requestingStudentEmail.toLowerCase()
      ) {
        throw new ForbiddenException(
          'Payment does not belong to the authenticated student',
        );
      }

      return this.fulfillOnboarding(
        user,
        flutterwaveData,
        metadata,
        email,
        input.source,
        existing,
        input.registrationFallback,
      );
    }

    if (!user || user.role.name !== RoleName.STUDENT) {
      throw new NotFoundException('Student account not found for payment email');
    }

    if (
      input.source === 'api' &&
      input.requestingStudentEmail &&
      user.email.toLowerCase() !== input.requestingStudentEmail.toLowerCase()
    ) {
      throw new ForbiddenException(
        'Payment does not belong to the authenticated student',
      );
    }

    return this.fulfillCourse(
      user,
      flutterwaveData,
      metadata,
      input.source,
      existing,
    );
  }

  private async fulfillOnboarding(
    user: User | null,
    flutterwaveData: FlutterwaveVerifyData,
    metadata: PaymentMetadata,
    email: string,
    source: 'api' | 'webhook' | 'sync',
    existing: PaymentTransaction | null,
    registrationFallback?: Partial<OnboardingRegistrationInput>,
  ) {
    const studentAlreadyRegistered = Boolean(user);

    if (user && !user.partnerId) {
      throw new BadRequestException('Student is not linked to a partner');
    }

    const registrationInput = user
      ? null
      : this.resolveOnboardingRegistrationInput(
          metadata,
          flutterwaveData,
          email,
          registrationFallback,
        );

    const partnerId = user?.partnerId ?? registrationInput!.partnerId;
    const partner = await this.partnersService.findOneEntity(partnerId);
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

    let pendingReceipt:
      | { student: User; transaction: PaymentTransaction }
      | undefined;

    const result = await this.dataSource.transaction(async (manager) => {
      let student = user;

      if (!student) {
        try {
          student = await this.studentsService.createStudentFromOnboardingPayment(
            manager,
            registrationInput!,
          );
        } catch (error) {
          if (error instanceof ConflictException) {
            const existingStudent = await this.userService.findByEmail(email);
            if (!existingStudent || existingStudent.role.name !== RoleName.STUDENT) {
              throw error;
            }
            student = existingStudent;
          } else {
            throw error;
          }
        }
      }

      const transaction = await this.saveTransaction(manager, {
        existing,
        flutterwaveData,
        paidFor: PaidFor.ONBOARDING,
        user: student,
        partner,
        courseId: null,
        partnerCut,
        platformCut,
        metadata,
        source,
      });

      if (transaction.fulfillmentCompleted) {
        return {
          ...this.serializeTransaction(transaction),
          alreadyFulfilled: true,
          studentAlreadyRegistered,
          studentCreated: !studentAlreadyRegistered,
        };
      }

      if (student.onboardingStatus !== OnboardingStatus.ONBOARDED) {
        student.onboardingStatus = OnboardingStatus.ONBOARDED;
        await manager.save(student);
      }

      transaction.fulfillmentCompleted = true;
      await manager.save(transaction);

      if (source !== 'sync') {
        pendingReceipt = { student, transaction };
      }

      return {
        ...this.serializeTransaction(transaction),
        alreadyFulfilled: false,
        studentAlreadyRegistered,
        studentCreated: !studentAlreadyRegistered,
      };
    });

    if (pendingReceipt) {
      await this.sendOnboardingReceipt(
        pendingReceipt.student,
        pendingReceipt.transaction,
      );
    }

    return result;
  }

  private resolveOnboardingRegistrationInput(
    metadata: PaymentMetadata,
    flutterwaveData: FlutterwaveVerifyData,
    email: string,
    registrationFallback?: Partial<OnboardingRegistrationInput>,
  ): OnboardingRegistrationInput {
    const partnerId = metadata.partnerId ?? registrationFallback?.partnerId;
    const accessCode = metadata.accessCode ?? registrationFallback?.accessCode;
    const fullName =
      metadata.fullName ??
      registrationFallback?.fullName ??
      flutterwaveData.customer?.name;
    const phone =
      metadata.phone ??
      registrationFallback?.phone ??
      flutterwaveData.customer?.phone_number;

    if (!partnerId) {
      throw new BadRequestException(
        'Payment metadata must include partnerId for onboarding registration',
      );
    }

    if (!accessCode) {
      throw new BadRequestException(
        'Payment metadata must include accessCode for onboarding registration',
      );
    }

    if (!fullName?.trim()) {
      throw new BadRequestException(
        'Payment metadata must include fullName for onboarding registration',
      );
    }

    if (!phone?.trim()) {
      throw new BadRequestException(
        'Payment metadata must include phone for onboarding registration',
      );
    }

    return {
      email,
      partnerId,
      accessCode,
      fullName: fullName.trim(),
      phone: phone.trim(),
    };
  }

  private buildRegistrationFallback(
    meta: PaymentMetadata,
    customer: {
      email?: string;
      name?: string;
      phone_number?: string;
    },
  ): Partial<OnboardingRegistrationInput> | undefined {
    const fallback = {
      email: meta.email ?? customer.email,
      partnerId: meta.partnerId,
      accessCode: meta.accessCode,
      fullName: meta.fullName ?? customer.name,
      phone: meta.phone ?? customer.phone_number,
    };

    const hasAny = Object.values(fallback).some((value) => Boolean(value));
    return hasAny ? fallback : undefined;
  }

  private async fulfillCourse(
    user: User,
    flutterwaveData: FlutterwaveVerifyData,
    metadata: PaymentMetadata,
    source: 'api' | 'webhook' | 'sync',
    existing: PaymentTransaction | null,
  ) {
    if (user.onboardingStatus !== OnboardingStatus.ONBOARDED) {
      throw new BadRequestException('Student must complete onboarding before purchasing courses');
    }

    const courseId = metadata.courseId;

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

    const partner = user.partnerId
      ? await this.partnersService.findOneEntity(user.partnerId)
      : null;

    let pendingDelivery:
      | { user: User; courseId: string; courseTitle: string }
      | undefined;

    const result = await this.dataSource.transaction(async (manager) => {
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

      if (source !== 'sync' && !existingEnrollment?.unlockedAt) {
        pendingDelivery = {
          user,
          courseId: course.id,
          courseTitle: course.title,
        };
      }

      return {
        ...this.serializeTransaction(transaction),
        enrollmentId: enrollment.id,
      };
    });

    if (pendingDelivery) {
      await this.deliverCourseAccess(
        pendingDelivery.user,
        pendingDelivery.courseId,
        pendingDelivery.courseTitle,
      );
    }

    return result;
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
      metadata: PaymentMetadata;
      source: 'api' | 'webhook' | 'sync';
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

    payload.txRef = input.flutterwaveData.tx_ref || null;
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

  private async findExistingTransaction(
    flutterwaveData: FlutterwaveVerifyData,
  ): Promise<PaymentTransaction | null> {
    const byExternal = await this.transactionsRepository.findOne({
      where: {
        paymentPlatform: PaymentPlatform.FLUTTERWAVE,
        externalTransactionId: String(flutterwaveData.id),
      },
      relations: ['user', 'course'],
    });

    if (byExternal) {
      return byExternal;
    }

    if (flutterwaveData.tx_ref) {
      return this.transactionsRepository.findOne({
        where: {
          paymentPlatform: PaymentPlatform.FLUTTERWAVE,
          txRef: flutterwaveData.tx_ref,
        },
        relations: ['user', 'course'],
      });
    }

    return null;
  }

  private async resolveFlutterwaveData(
    input: VerifyPaymentInput,
  ): Promise<FlutterwaveVerifyData> {
    if (input.txRef) {
      return this.flutterwaveService.verifyByReference(input.txRef);
    }

    if (input.transactionId) {
      return this.flutterwaveService.verifyByTransactionId(input.transactionId);
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
