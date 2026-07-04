import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequireRole } from '../common/abac/decorators/require-role.decorator';
import { JwtAuthGuard } from '../common/abac/guards/jwt-auth.guard';
import { RoleGuard } from '../common/abac/guards/role.guard';
import { STAFF_COURSE_ROLES } from '../common/constants/staff-roles.constants';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import {
  ApiOkPaginated,
  CourseEnrollmentReportDto,
  PaymentTransactionResponseDto,
  UserResponseDto,
} from '../common/swagger';
import { CoursesService } from '../courses/courses.service';
import { StudentsService } from '../students/students.service';

@ApiTags('admin/reports')
@ApiBearerAuth()
@RequireRole(...STAFF_COURSE_ROLES)
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('admin')
export class AdminReportsController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly studentsService: StudentsService,
  ) {}

  @Get('students')
  @ApiOkPaginated(UserResponseDto)
  @ResponseMessage('Students retrieved successfully')
  findStudents(@Query() query: PaginationQueryDto) {
    return this.studentsService.findAllStudents(query);
  }

  @Get('enrollments')
  @ApiOkPaginated(CourseEnrollmentReportDto)
  @ResponseMessage('Enrollments retrieved successfully')
  findEnrollments(@Query() query: PaginationQueryDto) {
    return this.coursesService.findAllEnrollments(query);
  }

  @Get('payments/onboarding')
  @ApiOkPaginated(PaymentTransactionResponseDto)
  @ResponseMessage('Onboarding payments retrieved successfully')
  findOnboardingPayments(@Query() query: PaginationQueryDto) {
    return this.coursesService.findOnboardingPayments(query);
  }

  @Get('payments/courses')
  @ApiOkPaginated(PaymentTransactionResponseDto)
  @ResponseMessage('Course payments retrieved successfully')
  findCoursePayments(@Query() query: PaginationQueryDto) {
    return this.coursesService.findCoursePayments(query);
  }
}
