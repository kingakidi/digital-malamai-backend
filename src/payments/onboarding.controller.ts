import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/abac/decorators/current-user.decorator';
import { RequireRole } from '../common/abac/decorators/require-role.decorator';
import { JwtAuthGuard } from '../common/abac/guards/jwt-auth.guard';
import { RoleGuard } from '../common/abac/guards/role.guard';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { RoleName } from '../common/types/permission.types';
import { ApiOkData, OnboardingStatusResponseDto } from '../common/swagger';
import { PaymentsService } from './payments.service';

@ApiTags('onboarding')
@ApiBearerAuth()
@RequireRole(RoleName.STUDENT)
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('status')
  @ApiOkData(OnboardingStatusResponseDto)
  @ResponseMessage('Onboarding status retrieved successfully')
  getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.getOnboardingStatus(user.id);
  }

  @Post('skip-phone-verification')
  @ResponseMessage('Phone verification skipped')
  skipPhoneVerification(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.skipPhoneVerification(user.id);
  }
}
