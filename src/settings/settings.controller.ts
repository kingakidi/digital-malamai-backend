import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequireRole } from '../common/abac/decorators/require-role.decorator';
import { JwtAuthGuard } from '../common/abac/guards/jwt-auth.guard';
import { RoleGuard } from '../common/abac/guards/role.guard';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { RoleName } from '../common/types/permission.types';
import { ApiOkData, SystemSettingResponseDto } from '../common/swagger';
import { UpdateOnboardingFeeDto } from './dto/update-onboarding-fee.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('onboarding-fee')
  @ApiOkData(SystemSettingResponseDto)
  @ResponseMessage('Onboarding fee retrieved successfully')
  getOnboardingFee() {
    return this.settingsService.getOnboardingFee();
  }
}

@ApiTags('admin/settings')
@ApiBearerAuth()
@RequireRole(RoleName.SUPERADMIN)
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('onboarding-fee')
  @ApiOkData(SystemSettingResponseDto)
  @ResponseMessage('Onboarding fee retrieved successfully')
  getOnboardingFee() {
    return this.settingsService.getOnboardingFee();
  }

  @Put('onboarding-fee')
  @ApiOkData(SystemSettingResponseDto)
  @ResponseMessage('Onboarding fee updated successfully')
  updateOnboardingFee(@Body() dto: UpdateOnboardingFeeDto) {
    return this.settingsService.setOnboardingFee(
      dto.amount,
      dto.currency ?? 'NGN',
    );
  }
}
