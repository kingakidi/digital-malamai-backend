import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import {
  ApiCreatedData,
  ApiOkData,
  AuthTokenResponseDto,
  MessageResponseDto,
  OtpSentResponseDto,
  PaymentEligibilityResponseDto,
  PaymentVerifyResponseDto,
  StudentRegistrationValidatedResponseDto,
  UserProfileResponseDto,
  UserResponseDto,
} from '../common/swagger';
import { CurrentUser } from '../common/abac/decorators/current-user.decorator';
import { SkipMustChangePasswordCheck } from '../common/abac/decorators/skip-must-change-password.decorator';
import { RequireRole } from '../common/abac/decorators/require-role.decorator';
import { JwtAuthGuard } from '../common/abac/guards/jwt-auth.guard';
import { RoleGuard } from '../common/abac/guards/role.guard';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { RoleName } from '../common/types/permission.types';
import { buildRolePermissionView } from '../common/utils/permission.util';
import { ForgotPasswordResetDto } from '../otps/dto/forgot-password-reset.dto';
import { ForgotPasswordSendDto } from '../otps/dto/forgot-password-send.dto';
import { SendOtpDto } from '../otps/dto/send-otp.dto';
import { VerifyOtpDto } from '../otps/dto/verify-otp.dto';
import { OtpsService } from '../otps/otps.service';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RegisterStudentDto } from './dto/register-student.dto';
import { SignInDto } from './dto/sign-in.dto';
import { StudentSignInDto } from './dto/student-sign-in.dto';
import { VerifyOnboardingPaymentDto } from '../payments/dto/verify-onboarding-payment.dto';
import { CheckPaymentEligibilityDto } from '../payments/dto/check-payment-eligibility.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly otpsService: OtpsService,
  ) {}

  @Post('login')
  @ApiCreatedData(AuthTokenResponseDto)
  @ResponseMessage('Login successful')
  login(@Body() signInDto: SignInDto) {
    return this.authService.login(signInDto);
  }

  @Post('staff/login')
  @ApiCreatedData(AuthTokenResponseDto)
  @ResponseMessage('Staff login successful')
  staffLogin(@Body() signInDto: SignInDto) {
    return this.authService.login(signInDto);
  }

  @Post('student/check-payment-eligibility')
  @ApiOkData(PaymentEligibilityResponseDto)
  @ResponseMessage('Payment eligibility checked successfully')
  checkPaymentEligibility(@Body() dto: CheckPaymentEligibilityDto) {
    return this.authService.checkPaymentEligibility(dto);
  }

  @Post('student/register')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedData(StudentRegistrationValidatedResponseDto)
  @ResponseMessage('Student registration validated successfully')
  registerStudent(@Body() dto: RegisterStudentDto) {
    return this.authService.registerStudent(dto);
  }

  @Post('student/verify-onboarding-payment')
  @ApiCreatedData(PaymentVerifyResponseDto)
  @ResponseMessage('Onboarding payment verified successfully')
  verifyOnboardingPayment(@Body() dto: VerifyOnboardingPaymentDto) {
    return this.authService.verifyOnboardingPayment(dto);
  }

  @Post('student/requery-onboarding-payment')
  @ApiCreatedData(PaymentVerifyResponseDto)
  @ResponseMessage('Onboarding payment requeried successfully')
  requeryOnboardingPayment(@Body() dto: VerifyOnboardingPaymentDto) {
    return this.authService.requeryOnboardingPayment(dto);
  }

  @Post('student/login')
  @ApiCreatedData(AuthTokenResponseDto)
  @ResponseMessage('Student login successful')
  studentLogin(@Body() dto: StudentSignInDto) {
    return this.authService.studentLogin(dto);
  }

  @ApiBearerAuth()
  @RequireRole(RoleName.STUDENT)
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Post('otp/send')
  @ApiCreatedData(OtpSentResponseDto)
  @ResponseMessage('OTP sent successfully')
  sendOtp(@CurrentUser() user: AuthenticatedUser, @Body() dto: SendOtpDto) {
    return this.otpsService.sendVerificationOtp(user.id, dto.type);
  }

  @ApiBearerAuth()
  @RequireRole(RoleName.STUDENT)
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Post('otp/verify')
  @ApiCreatedData(UserResponseDto)
  @ResponseMessage('OTP verified successfully')
  verifyOtp(@CurrentUser() user: AuthenticatedUser, @Body() dto: VerifyOtpDto) {
    return this.otpsService.verifyVerificationOtp(user.id, dto.type, dto.code);
  }

  @Post('forgot-password/send')
  @ApiCreatedData(MessageResponseDto)
  @ResponseMessage('Password reset OTP sent if account exists')
  sendForgotPasswordOtp(@Body() dto: ForgotPasswordSendDto) {
    return this.otpsService.sendForgotPasswordOtp(dto.identifier, dto.type);
  }

  @Post('forgot-password/reset')
  @ApiCreatedData(MessageResponseDto)
  @ResponseMessage('Password reset successfully')
  resetForgotPassword(@Body() dto: ForgotPasswordResetDto) {
    return this.otpsService.resetPasswordWithOtp(
      dto.identifier,
      dto.type,
      dto.code,
      dto.newPassword,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @SkipMustChangePasswordCheck()
  @Patch('change-password')
  @ApiOkData(MessageResponseDto)
  @ResponseMessage('Password changed successfully')
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @SkipMustChangePasswordCheck()
  @Get('profile')
  @ApiOkData(UserProfileResponseDto)
  @ResponseMessage('Profile retrieved successfully')
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.userService.findByIdWithRole(user.id);

    if (!profile) {
      return user;
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
}
