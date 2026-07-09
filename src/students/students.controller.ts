import { Body, Controller, Get, Put, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/abac/decorators/current-user.decorator';
import { RequireRole } from '../common/abac/decorators/require-role.decorator';
import { JwtAuthGuard } from '../common/abac/guards/jwt-auth.guard';
import { RoleGuard } from '../common/abac/guards/role.guard';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { RoleName } from '../common/types/permission.types';
import { CoursesService } from '../courses/courses.service';
import { SendOtpDto } from '../otps/dto/send-otp.dto';
import { OtpsService } from '../otps/otps.service';
import {
  ApiCreatedData,
  ApiOkData,
  MessageResponseDto,
  OtpSentResponseDto,
  StudentEnrollmentResponseDto,
  UserResponseDto,
} from '../common/swagger';
import { StudentChangePasswordDto } from './dto/student-change-password.dto';
import { StudentsService } from './students.service';

@ApiTags('students')
@ApiBearerAuth()
@RequireRole(RoleName.STUDENT)
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('students')
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly otpsService: OtpsService,
    private readonly coursesService: CoursesService,
  ) {}

  @Get('me')
  @ApiOkData(UserResponseDto)
  @ResponseMessage('Student profile retrieved successfully')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.studentsService.getProfile(user.id);
  }

  @Get('enrollments')
  @ApiOkData(StudentEnrollmentResponseDto, { isArray: true })
  @ResponseMessage('Enrollments retrieved successfully')
  getEnrollments(@CurrentUser() user: AuthenticatedUser) {
    return this.coursesService.findEnrollmentsByUser(user.id);
  }

  @Post('change-password/send-otp')
  @ApiCreatedData(OtpSentResponseDto)
  @ResponseMessage('Password change OTP sent successfully')
  sendChangePasswordOtp(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendOtpDto,
  ) {
    return this.otpsService.sendPasswordResetOtpForUser(user.id, dto.type);
  }

  @Put('change-password')
  @ApiOkData(MessageResponseDto)
  @ResponseMessage('Password changed successfully')
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StudentChangePasswordDto,
  ) {
    return this.otpsService.changePasswordWithOtp(
      user.id,
      dto.type,
      dto.code,
      dto.newPassword,
    );
  }
}
