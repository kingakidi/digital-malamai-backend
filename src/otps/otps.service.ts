import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { PhoneMessagingService } from '../mail/phone-messaging.service';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '../common/types/notification.types';
import { OtpChannel, OtpPurpose } from '../common/types/otp.types';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../user/entities/user.entity';
import { RoleName } from '../common/types/permission.types';
import { UserService } from '../user/user.service';
import { Otp } from './entities/otp.entity';
import { resolveOnboardingStatus } from './utils/onboarding-status.util';
import {
  generateOtpCode,
  hashOtpCode,
  verifyOtpCode,
} from './utils/otp.util';

@Injectable()
export class OtpsService {
  constructor(
    @InjectRepository(Otp)
    private readonly otpsRepository: Repository<Otp>,
    private readonly userService: UserService,
    private readonly mailService: MailService,
    private readonly phoneMessagingService: PhoneMessagingService,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  async sendVerificationOtp(userId: string, channel: OtpChannel) {
    const user = await this.getStudentUser(userId);
    const purpose = this.resolveVerificationPurpose(channel);

    const alreadyVerified =
      channel === OtpChannel.EMAIL
        ? Boolean(user.emailVerifiedAt)
        : Boolean(user.phoneVerifiedAt);

    if (alreadyVerified) {
      throw new BadRequestException(`Your ${channel} is already verified`);
    }

    this.assertChannelDestination(user, channel);

    return this.createAndDispatchOtp(user, channel, purpose);
  }

  async verifyVerificationOtp(
    userId: string,
    channel: OtpChannel,
    code: string,
  ) {
    const user = await this.getStudentUser(userId);
    const purpose = this.resolveVerificationPurpose(channel);

    await this.consumeOtp(user.id, channel, purpose, code);

    if (channel === OtpChannel.EMAIL) {
      user.emailVerifiedAt = new Date();
    } else {
      user.phoneVerifiedAt = new Date();
    }

    user.onboardingStatus = resolveOnboardingStatus(user);
    await this.userService.save(user);

    return this.userService.sanitizeUser(user);
  }

  async sendForgotPasswordOtp(identifier: string, channel: OtpChannel) {
    const user = await this.findStudentByIdentifier(identifier);

    if (!user) {
      return { message: 'If the account exists, an OTP has been sent' };
    }

    this.assertChannelDestination(user, channel);

    await this.createAndDispatchOtp(user, channel, OtpPurpose.PASSWORD_RESET);

    return { message: 'If the account exists, an OTP has been sent' };
  }

  async resetPasswordWithOtp(
    identifier: string,
    channel: OtpChannel,
    code: string,
    newPassword: string,
  ) {
    const user = await this.findStudentByIdentifier(identifier);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.consumeOtp(user.id, channel, OtpPurpose.PASSWORD_RESET, code);
    await this.setUserPassword(user, newPassword);

    return { message: 'Password updated successfully' };
  }

  async sendPasswordResetOtpForUser(userId: string, channel: OtpChannel) {
    const user = await this.getStudentUser(userId);
    this.assertChannelDestination(user, channel);
    return this.createAndDispatchOtp(user, channel, OtpPurpose.PASSWORD_RESET);
  }

  async changePasswordWithOtp(
    userId: string,
    channel: OtpChannel,
    code: string,
    newPassword: string,
  ) {
    const user = await this.getStudentUser(userId);

    await this.consumeOtp(user.id, channel, OtpPurpose.PASSWORD_RESET, code);
    await this.setUserPassword(user, newPassword);

    return { message: 'Password updated successfully' };
  }

  private async createAndDispatchOtp(
    user: User,
    channel: OtpChannel,
    purpose: OtpPurpose,
  ) {
    await this.invalidateActiveOtps(user.id, channel, purpose);

    const code = generateOtpCode();
    const ttlMinutes = this.configService.get<number>('otp.ttlMinutes') ?? 10;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    const otp = this.otpsRepository.create({
      userId: user.id,
      codeHash: hashOtpCode(code, this.getHashSecret()),
      channel,
      purpose,
      expiresAt,
    });

    await this.otpsRepository.save(otp);

    try {
      await this.dispatchOtp(user, channel, purpose, code, ttlMinutes);

      await this.notificationsService.log({
        userId: user.id,
        channel:
          channel === OtpChannel.EMAIL
            ? NotificationChannel.EMAIL
            : NotificationChannel.WHATSAPP,
        type: NotificationType.OTP,
        payload: { purpose, channel },
        status: NotificationStatus.SENT,
        sentAt: new Date(),
      });
    } catch (error) {
      await this.notificationsService.log({
        userId: user.id,
        channel:
          channel === OtpChannel.EMAIL
            ? NotificationChannel.EMAIL
            : NotificationChannel.WHATSAPP,
        type: NotificationType.OTP,
        payload: {
          purpose,
          channel,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        status: NotificationStatus.FAILED,
      });

      throw new BadRequestException('Unable to send OTP. Try again later.');
    }

    return {
      message: 'OTP sent successfully',
      channel,
      purpose,
      expiresInMinutes: ttlMinutes,
    };
  }

  private async dispatchOtp(
    user: User,
    channel: OtpChannel,
    purpose: OtpPurpose,
    code: string,
    ttlMinutes: number,
  ) {
    const variables = {
      firstName: user.firstName,
      otp: code,
      expiresInMinutes: String(ttlMinutes),
    };

    if (channel === OtpChannel.EMAIL) {
      const templateName = this.resolveEmailTemplate(purpose);
      await this.mailService.sendTemplateMail(
        user.email,
        templateName,
        variables,
      );
      return;
    }

    if (!user.phone) {
      throw new BadRequestException('Phone number is not set on this account');
    }

    const templateName =
      purpose === OtpPurpose.PASSWORD_RESET
        ? 'password-reset'
        : 'phone-verification';

    await this.phoneMessagingService.sendOtpMessage(
      user.phone,
      templateName,
      variables,
    );
  }

  private async consumeOtp(
    userId: string,
    channel: OtpChannel,
    purpose: OtpPurpose,
    code: string,
  ) {
    const otp = await this.otpsRepository.findOne({
      where: {
        userId,
        channel,
        purpose,
        verifiedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });

    if (!otp || !verifyOtpCode(code, otp.codeHash, this.getHashSecret())) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    otp.verifiedAt = new Date();
    await this.otpsRepository.save(otp);
  }

  private async invalidateActiveOtps(
    userId: string,
    channel: OtpChannel,
    purpose: OtpPurpose,
  ) {
    await this.otpsRepository.delete({
      userId,
      channel,
      purpose,
      verifiedAt: IsNull(),
    });
  }

  private async setUserPassword(user: User, newPassword: string) {
    user.password = await bcrypt.hash(newPassword, 10);
    await this.userService.save(user);
  }

  private resolveVerificationPurpose(channel: OtpChannel): OtpPurpose {
    return channel === OtpChannel.EMAIL
      ? OtpPurpose.VERIFY_EMAIL
      : OtpPurpose.VERIFY_PHONE;
  }

  private resolveEmailTemplate(purpose: OtpPurpose): string {
    switch (purpose) {
      case OtpPurpose.PASSWORD_RESET:
        return 'password-reset';
      case OtpPurpose.VERIFY_PHONE:
        return 'phone-verification';
      case OtpPurpose.VERIFY_EMAIL:
      default:
        return 'email-verification';
    }
  }

  private assertChannelDestination(user: User, channel: OtpChannel) {
    if (channel === OtpChannel.EMAIL && !user.email) {
      throw new BadRequestException('Email is not set on this account');
    }

    if (channel === OtpChannel.PHONE && !user.phone) {
      throw new BadRequestException('Phone number is not set on this account');
    }
  }

  private async getStudentUser(userId: string): Promise<User> {
    const user = await this.userService.findByIdWithRole(userId);

    if (!user || user.role.name !== RoleName.STUDENT) {
      throw new NotFoundException('Student not found');
    }

    return user;
  }

  private findStudentByIdentifier(identifier: string): Promise<User | null> {
    return this.userService.findStudentByIdentifier(identifier);
  }

  private getHashSecret(): string {
    return this.configService.get<string>('otp.hashSecret') ?? 'change-me';
  }
}
