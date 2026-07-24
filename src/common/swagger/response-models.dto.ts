import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountStatus } from '../types/account-status.type';
import { OnboardingStatus } from '../types/onboarding-status.type';
import { PartnerStatus } from '../types/partner-status.type';
import {
  CommissionType,
  CourseStatus,
  PaidFor,
  PaymentPlatform,
  PaymentStatus,
} from '../types/payment.types';

export class MessageResponseDto {
  @ApiProperty({ example: 'Password updated successfully' })
  message: string;
}

export class OtpSentResponseDto {
  @ApiProperty({ example: 'OTP sent successfully' })
  message: string;

  @ApiProperty({ example: 'email' })
  channel: string;

  @ApiProperty({ example: 'email_verification' })
  purpose: string;

  @ApiProperty({ example: 10 })
  expiresInMinutes: number;
}

export class PermissionGroupPermissionDto {
  @ApiProperty()
  key: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  granted: boolean;
}

export class PermissionGroupStateDto {
  @ApiProperty()
  key: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ type: [PermissionGroupPermissionDto] })
  permissions: PermissionGroupPermissionDto[];
}

export class RoleBasicDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class RoleResponseDto extends RoleBasicDto {
  @ApiProperty({ type: [String] })
  permissionKeys: string[];

  @ApiProperty({ type: [PermissionGroupStateDto] })
  permissionGroups: PermissionGroupStateDto[];
}

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional({ nullable: true })
  phone: string | null;

  @ApiPropertyOptional({ nullable: true })
  emailVerifiedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  phoneVerifiedAt: Date | null;

  @ApiPropertyOptional({ enum: OnboardingStatus, nullable: true })
  onboardingStatus: OnboardingStatus | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ enum: AccountStatus })
  accountStatus: AccountStatus;

  @ApiProperty({
    description:
      'When true, partner must change password before using protected routes',
  })
  mustChangePassword: boolean;

  @ApiProperty({ type: RoleBasicDto })
  role: RoleBasicDto;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  partnerId: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  accessCodeId: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class UserProfileResponseDto extends UserResponseDto {
  @ApiProperty({ type: RoleResponseDto })
  declare role: RoleResponseDto;
}

export class AuthTokenResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({ type: UserProfileResponseDto })
  user: UserProfileResponseDto;
}

export class PublicPartnerResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional({ nullable: true })
  phoneNumber: string | null;

  @ApiPropertyOptional({ nullable: true })
  address: string | null;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiPropertyOptional({ nullable: true })
  logoUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  onboardingFee: number | null;

  @ApiProperty({ enum: PartnerStatus })
  status: PartnerStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PartnerResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional({ nullable: true })
  phoneNumber: string | null;

  @ApiPropertyOptional({ nullable: true })
  address: string | null;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiPropertyOptional({ nullable: true })
  logoUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  onboardingFee: number | null;

  @ApiPropertyOptional({ enum: CommissionType, nullable: true })
  commissionType: CommissionType | null;

  @ApiPropertyOptional({ nullable: true })
  commissionValue: number | null;

  @ApiProperty()
  onboardPercentage: number;

  @ApiProperty({ enum: PartnerStatus })
  status: PartnerStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Number of students linked to this partner',
  })
  studentCount?: number;

  @ApiPropertyOptional({
    description: 'Number of access codes for this partner',
  })
  accessCodeCount?: number;
}

export class CreatePartnerWithUserResponseDto {
  @ApiProperty({ type: PartnerResponseDto })
  partner: PartnerResponseDto;

  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
}

export class AccessCodeStudentDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;
}

export class AccessCodeResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  code: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  partnerId: string | null;

  @ApiProperty()
  isUsed: boolean;

  @ApiPropertyOptional({ nullable: true })
  expiresAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  exportedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional({ type: AccessCodeStudentDto, nullable: true })
  student: AccessCodeStudentDto | null;
}

export class AccessCodeStatsResponseDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  used: number;

  @ApiProperty()
  unused: number;

  @ApiProperty()
  expired: number;

  @ApiProperty()
  exported: number;

  @ApiProperty({ description: 'Unused, not expired, not yet exported' })
  readyToExport: number;

  @ApiProperty({
    description: 'Unused, not expired, previously exported (re-exportable)',
  })
  reexportable: number;
}

export class ExportUnusedAccessCodesResultDto {
  @ApiProperty({ type: [String], description: 'Unused access code values' })
  codes: string[];
}

export class MarkAccessCodesExportedResultDto {
  @ApiProperty()
  marked: number;
}

export class GenerateAccessCodesResultDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  partnerId: string | null;

  @ApiProperty()
  requested: number;

  @ApiProperty()
  generated: number;

  @ApiPropertyOptional({
    type: [AccessCodeResponseDto],
    description: 'Included only when generated count is 50 or fewer',
  })
  codes?: AccessCodeResponseDto[];
}

export class DeleteAccessCodesResultDto {
  @ApiProperty()
  deleted: number;

  @ApiProperty({
    description: 'Codes skipped because they are used or linked to a student',
  })
  skipped: number;
}

export class CourseEnrollmentSummaryDto {
  @ApiProperty()
  isEnrolled: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  enrollmentId: string | null;

  @ApiPropertyOptional({ nullable: true })
  enrolledAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  unlockedAt: Date | null;
}

export class CourseWithEnrollmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiPropertyOptional({ nullable: true })
  thumbnailUrl: string | null;

  @ApiProperty()
  price: number;

  @ApiProperty()
  discount: number;

  @ApiProperty()
  isFree: boolean;

  @ApiProperty()
  effectivePrice: number;

  @ApiProperty({ enum: CourseStatus })
  status: CourseStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: CourseEnrollmentSummaryDto })
  enrollment: CourseEnrollmentSummaryDto;
}

export class CourseResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiPropertyOptional({ nullable: true })
  thumbnailUrl: string | null;

  @ApiProperty()
  price: number;

  @ApiProperty()
  discount: number;

  @ApiProperty()
  isFree: boolean;

  @ApiProperty({ enum: CourseStatus })
  status: CourseStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class CourseVideoResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  courseId: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  vimeoUrl: string;

  @ApiProperty()
  position: number;

  @ApiPropertyOptional({ nullable: true })
  duration: number | null;

  @ApiPropertyOptional({ nullable: true })
  details: string | null;

  @ApiProperty()
  createdAt: Date;
}

export class StudentEnrollmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  enrolledAt: Date;

  @ApiPropertyOptional({ nullable: true })
  unlockedAt: Date | null;

  @ApiProperty({ enum: PaymentStatus })
  paymentStatus: PaymentStatus;

  @ApiPropertyOptional({ type: CourseWithEnrollmentResponseDto, nullable: true })
  course: CourseWithEnrollmentResponseDto | null;
}

export class SystemSettingResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  key: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaymentTransactionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: PaymentPlatform })
  paymentPlatform: PaymentPlatform;

  @ApiProperty()
  externalTransactionId: string;

  @ApiPropertyOptional({ nullable: true })
  txRef: string | null;

  @ApiProperty({ enum: PaidFor })
  paidFor: PaidFor;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  userId: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  partnerId: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  courseId: string | null;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  fees: number;

  @ApiProperty()
  partnerCut: number;

  @ApiProperty()
  platformCut: number;

  @ApiProperty()
  currency: string;

  @ApiProperty({ enum: PaymentStatus })
  status: PaymentStatus;

  @ApiProperty()
  webhookVerified: boolean;

  @ApiProperty()
  apiVerified: boolean;

  @ApiProperty()
  fulfillmentCompleted: boolean;

  @ApiPropertyOptional({ nullable: true })
  verifiedAt: Date | null;

  @ApiProperty()
  createdAt: Date;
}

export class PaymentVerifyResponseDto extends PaymentTransactionResponseDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  enrollmentId?: string | null;
}

export class StudentRegistrationValidatedResponseDto {
  @ApiProperty({ example: true })
  validated: boolean;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  partnerId: string | null;

  @ApiProperty({ example: 5000 })
  onboardingFee: number;

  @ApiProperty({ example: 'NGN' })
  currency: string;
}

export class PaymentEligibilityResponseDto {
  @ApiProperty()
  eligible: boolean;

  @ApiProperty()
  alreadyPaid: boolean;

  @ApiProperty({ enum: PaidFor })
  paidFor: PaidFor;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  partnerId: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  courseId: string | null;

  @ApiPropertyOptional({ enum: ['database', 'flutterwave'], nullable: true })
  source: 'database' | 'flutterwave' | null;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional({ nullable: true })
  matchedTransactionId: string | null;
}

export class PaymentSyncItemResponseDto {
  @ApiProperty()
  externalTransactionId: string;

  @ApiPropertyOptional({ nullable: true })
  txRef: string | null;

  @ApiPropertyOptional({ enum: PaidFor, nullable: true })
  paidFor: PaidFor | null;

  @ApiProperty({ enum: ['synced', 'recorded', 'skipped', 'failed'] })
  status: 'synced' | 'recorded' | 'skipped' | 'failed';

  @ApiPropertyOptional()
  reason?: string;
}

export class PaymentSyncSummaryResponseDto {
  @ApiProperty({ example: 3 })
  days: number;

  @ApiProperty({ example: '2026-07-01' })
  from: string;

  @ApiProperty({ example: '2026-07-08' })
  to: string;

  @ApiProperty()
  totalFetched: number;

  @ApiProperty()
  synced: number;

  @ApiProperty({
    description: 'Failed Flutterwave payments saved locally without enrollment',
  })
  recorded: number;

  @ApiProperty()
  skipped: number;

  @ApiProperty()
  failed: number;

  @ApiProperty({ type: [PaymentSyncItemResponseDto] })
  items: PaymentSyncItemResponseDto[];
}

export class OnboardingStatusResponseDto {
  @ApiPropertyOptional({ enum: OnboardingStatus, nullable: true })
  onboardingStatus: OnboardingStatus | null;

  @ApiPropertyOptional({ nullable: true })
  emailVerifiedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  phoneVerifiedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  phoneVerificationSkippedAt: Date | null;

  @ApiProperty()
  expectedOnboardingFee: number;

  @ApiPropertyOptional({ type: PaymentTransactionResponseDto, nullable: true })
  latestOnboardingPayment: PaymentTransactionResponseDto | null;
}

export class RevenueBucketResponseDto {
  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  partnerCut: number;

  @ApiProperty()
  transactionCount: number;
}

export class PartnerRevenueResponseDto {
  @ApiProperty({ format: 'uuid' })
  partnerId: string;

  @ApiProperty({ type: RevenueBucketResponseDto })
  onboarding: RevenueBucketResponseDto;

  @ApiProperty({ type: RevenueBucketResponseDto })
  courses: RevenueBucketResponseDto;
}

export class CourseEnrollmentReportDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ format: 'uuid' })
  courseId: string;

  @ApiProperty()
  enrolledAt: Date;

  @ApiProperty({ enum: PaymentStatus })
  paymentStatus: PaymentStatus;

  @ApiPropertyOptional({ nullable: true })
  unlockedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional({ type: UserResponseDto })
  user?: UserResponseDto;

  @ApiPropertyOptional({ type: CourseResponseDto })
  course?: CourseResponseDto;
}

export class PermissionDefinitionDto {
  @ApiProperty()
  key: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  resource: string;

  @ApiProperty()
  action: string;

  @ApiProperty()
  scope: string;
}

export class PermissionGroupDefinitionDto {
  @ApiProperty()
  key: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ type: [PermissionDefinitionDto] })
  permissions: PermissionDefinitionDto[];
}
