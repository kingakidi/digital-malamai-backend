import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

  @ApiProperty()
  isUsed: boolean;

  @ApiPropertyOptional({ nullable: true })
  expiresAt: Date | null;

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

  @ApiProperty({ format: 'uuid' })
  partnerId: string;

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

  @ApiProperty({ format: 'uuid' })
  partnerId: string;

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

  @ApiPropertyOptional({ enum: CommissionType, nullable: true })
  partnerCommissionType: CommissionType | null;

  @ApiPropertyOptional({ nullable: true })
  partnerCommissionValue: number | null;

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
  duration: string | null;

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

  @ApiProperty({ format: 'uuid' })
  userId: string;

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

export class OnboardingStatusResponseDto {
  @ApiPropertyOptional({ enum: OnboardingStatus, nullable: true })
  onboardingStatus: OnboardingStatus | null;

  @ApiPropertyOptional({ nullable: true })
  emailVerifiedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  phoneVerifiedAt: Date | null;

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
