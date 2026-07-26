import { Controller, Get, Param, Put, Body, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequireRole } from '../common/abac/decorators/require-role.decorator';
import { JwtAuthGuard } from '../common/abac/guards/jwt-auth.guard';
import { RoleGuard } from '../common/abac/guards/role.guard';
import { STAFF_COURSE_ROLES } from '../common/constants/staff-roles.constants';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ReportFilterQueryDto } from '../common/dto/report-filter-query.dto';
import {
  ApiOkData,
  ApiOkPaginated,
  CourseEnrollmentReportDto,
  PaymentTransactionResponseDto,
  UserResponseDto,
} from '../common/swagger';
import { CoursesService } from '../courses/courses.service';
import { AdminPatchStudentDto } from '../students/dto/admin-patch-student.dto';
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
  findStudents(@Query() query: ReportFilterQueryDto) {
    return this.studentsService.findAllStudents(query);
  }

  @Get('students/:id')
  @ApiOkData(UserResponseDto)
  @ResponseMessage('Student retrieved successfully')
  findStudent(@Param('id', ParseUUIDPipe) id: string) {
    return this.studentsService.findStudentById(id);
  }

  @Put('students/:id')
  @ApiOkData(UserResponseDto)
  @ResponseMessage('Student account updated successfully')
  patchStudent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminPatchStudentDto,
  ) {
    return this.studentsService.patchStudentAccount(id, dto.accountStatus);
  }

  @Get('enrollments')
  @ApiOkPaginated(CourseEnrollmentReportDto)
  @ResponseMessage('Enrollments retrieved successfully')
  findEnrollments(@Query() query: ReportFilterQueryDto) {
    return this.coursesService.findAllEnrollments(query);
  }

  @Get('enrollments/:id')
  @ApiOkData(CourseEnrollmentReportDto)
  @ResponseMessage('Enrollment retrieved successfully')
  findEnrollmentById(@Param('id') id: string) {
    return this.coursesService.findEnrollmentById(id);
  }

  @Get('payments/onboarding')
  @ApiOkPaginated(PaymentTransactionResponseDto)
  @ResponseMessage('Onboarding payments retrieved successfully')
  findOnboardingPayments(@Query() query: ReportFilterQueryDto) {
    return this.coursesService.findOnboardingPayments(query);
  }

  @Get('payments/courses')
  @ApiOkPaginated(PaymentTransactionResponseDto)
  @ResponseMessage('Course payments retrieved successfully')
  findCoursePayments(@Query() query: ReportFilterQueryDto) {
    return this.coursesService.findCoursePayments(query);
  }

  @Get('transactions')
  @ApiOkPaginated(PaymentTransactionResponseDto)
  @ResponseMessage('Transactions retrieved successfully')
  findTransactions(@Query() query: ReportFilterQueryDto) {
    return this.coursesService.findAdminPayments(query);
  }

  @Get('transactions/:id')
  @ApiOkData(PaymentTransactionResponseDto)
  @ResponseMessage('Transaction retrieved successfully')
  findTransaction(@Param('id', ParseUUIDPipe) id: string) {
    return this.coursesService.findAdminPaymentById(id);
  }
}
