import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequireRole } from '../common/abac/decorators/require-role.decorator';
import { JwtAuthGuard } from '../common/abac/guards/jwt-auth.guard';
import { RoleGuard } from '../common/abac/guards/role.guard';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { RoleName } from '../common/types/permission.types';
import { ApiOkData, SystemSettingResponseDto } from '../common/swagger';
import {
  CourseDeliverySettingsResponseDto,
  FlagSettingResponseDto,
  UpdateFlagSettingDto,
} from './dto/update-course-lesson-watch-mode.dto';
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

  @Get('course-delivery')
  @ApiOkData(CourseDeliverySettingsResponseDto)
  @ResponseMessage('Course delivery settings retrieved successfully')
  getCourseDeliverySettings() {
    return this.settingsService.getCourseDeliverySettings();
  }

  @Get('course-lesson-watch')
  @ApiOkData(FlagSettingResponseDto)
  @ResponseMessage('Course lesson watch mode retrieved successfully')
  getCourseLessonWatchMode() {
    return this.settingsService.getCourseLessonWatchInApp();
  }

  @Get('course-whatsapp-delivery')
  @ApiOkData(FlagSettingResponseDto)
  @ResponseMessage('Course WhatsApp delivery setting retrieved successfully')
  getCourseWhatsappDelivery() {
    return this.settingsService.getCourseWhatsappDelivery();
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

  @Get('course-lesson-watch')
  @ApiOkData(FlagSettingResponseDto)
  @ResponseMessage('Course lesson watch mode retrieved successfully')
  getCourseLessonWatchMode() {
    return this.settingsService.getCourseLessonWatchInApp();
  }

  @Put('course-lesson-watch')
  @ApiOkData(FlagSettingResponseDto)
  @ResponseMessage('Course lesson watch mode updated successfully')
  updateCourseLessonWatchMode(@Body() dto: UpdateFlagSettingDto) {
    return this.settingsService.setCourseLessonWatchInApp(dto.enabled);
  }

  @Get('course-whatsapp-delivery')
  @ApiOkData(FlagSettingResponseDto)
  @ResponseMessage('Course WhatsApp delivery setting retrieved successfully')
  getCourseWhatsappDelivery() {
    return this.settingsService.getCourseWhatsappDelivery();
  }

  @Put('course-whatsapp-delivery')
  @ApiOkData(FlagSettingResponseDto)
  @ResponseMessage('Course WhatsApp delivery setting updated successfully')
  updateCourseWhatsappDelivery(@Body() dto: UpdateFlagSettingDto) {
    return this.settingsService.setCourseWhatsappDelivery(dto.enabled);
  }
}
