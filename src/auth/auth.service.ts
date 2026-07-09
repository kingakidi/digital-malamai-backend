import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { buildRolePermissionView } from '../common/utils/permission.util';
import { PaidFor } from '../common/types/payment.types';
import { PaymentEligibilityService } from '../payments/payment-eligibility.service';
import { CheckPaymentEligibilityDto } from '../payments/dto/check-payment-eligibility.dto';
import { PaymentFulfillmentService } from '../payments/payment-fulfillment.service';
import { VerifyOnboardingPaymentDto } from '../payments/dto/verify-onboarding-payment.dto';
import { StudentsService } from '../students/students.service';
import { UserService } from '../user/user.service';
import { RegisterStudentDto } from './dto/register-student.dto';
import { SignInDto } from './dto/sign-in.dto';
import { StudentSignInDto } from './dto/student-sign-in.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { assertAccountCanAuthenticate } from '../common/utils/account-access.util';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly studentsService: StudentsService,
    private readonly paymentFulfillmentService: PaymentFulfillmentService,
    private readonly paymentEligibilityService: PaymentEligibilityService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(signInDto: SignInDto) {
    const user = await this.userService.findByIdentifier(signInDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    assertAccountCanAuthenticate(user);

    const isValid = await this.studentsService.validateCredential(
      user,
      signInDto.password,
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(user);
  }

  registerStudent(dto: RegisterStudentDto) {
    return this.registerStudentWithEligibility(dto);
  }

  async registerStudentWithEligibility(dto: RegisterStudentDto) {
    const eligibility = await this.paymentEligibilityService.checkEligibility({
      email: dto.email,
      paidFor: PaidFor.ONBOARDING,
      partnerId: dto.partnerId,
    });

    if (!eligibility.eligible) {
      throw new ConflictException(eligibility.message);
    }

    return this.studentsService.register(dto);
  }

  verifyOnboardingPayment(dto: VerifyOnboardingPaymentDto) {
    return this.paymentFulfillmentService.verifyAndFulfill({
      transactionId: dto.transactionId,
      txRef: dto.txRef,
      source: 'api',
      forcedPaidFor: PaidFor.ONBOARDING,
      registrationFallback: {
        email: dto.email,
        partnerId: dto.partnerId,
        accessCode: dto.accessCode,
        fullName: dto.fullName,
        phone: dto.phone,
      },
    });
  }

  requeryOnboardingPayment(dto: VerifyOnboardingPaymentDto) {
    return this.verifyOnboardingPayment(dto);
  }

  checkPaymentEligibility(dto: CheckPaymentEligibilityDto) {
    return this.paymentEligibilityService.checkEligibility(dto);
  }

  studentLogin(dto: StudentSignInDto) {
    return this.login({ email: dto.identifier, password: dto.credential });
  }

  changePassword(userId: string, dto: { currentPassword: string; newPassword: string }) {
    return this.userService.changePasswordWithCurrent(
      userId,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const profile = await this.userService.updateOwnProfile(userId, dto);

    if (!profile) {
      throw new UnauthorizedException('User not found');
    }

    const sanitized = this.userService.sanitizeUser(profile);
    const rolePermissions = buildRolePermissionView(profile.role.permissions);

    return {
      ...sanitized,
      role: {
        ...sanitized.role,
        permissionKeys: rolePermissions.permissionKeys,
        permissionGroups: rolePermissions.permissionGroups,
      },
    };
  }

  private async buildAuthResponse(user: Awaited<ReturnType<UserService['findByEmail']>>) {
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: user.id,
      email: user.email,
    };

    const sanitized = this.userService.sanitizeUser(user);
    const rolePermissions = buildRolePermissionView(user.role.permissions);

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: {
        ...sanitized,
        role: {
          ...sanitized.role,
          permissionKeys: rolePermissions.permissionKeys,
          permissionGroups: rolePermissions.permissionGroups,
        },
      },
    };
  }
}
