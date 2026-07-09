import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/abac/decorators/current-user.decorator';
import { SkipMustChangePasswordCheck } from '../common/abac/decorators/skip-must-change-password.decorator';
import { RequirePermission } from '../common/abac/decorators/require-permission.decorator';
import { RequireRole } from '../common/abac/decorators/require-role.decorator';
import { JwtAuthGuard } from '../common/abac/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/abac/guards/permission.guard';
import { RoleGuard } from '../common/abac/guards/role.guard';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ReportFilterQueryDto } from '../common/dto/report-filter-query.dto';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  PermissionAction,
  PermissionResource,
  RoleName,
} from '../common/types/permission.types';
import { CreatePartnerWithUserDto } from './dto/create-partner-with-user.dto';
import { ChangePartnerPasswordDto } from './dto/change-partner-password.dto';
import { CreatePartnerDto } from './dto/create-partner.dto';
import {
  CreatePartnerTeamUserDto,
  UpdatePartnerTeamUserDto,
} from './dto/partner-team-user.dto';
import { UpdatePartnerFeesDto } from './dto/update-partner-fees.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import {
  ApiCreatedData,
  ApiOkData,
  ApiOkPaginated,
  CourseEnrollmentReportDto,
  CourseResponseDto,
  CreatePartnerWithUserResponseDto,
  MessageResponseDto,
  PartnerResponseDto,
  PartnerRevenueResponseDto,
  PaymentTransactionResponseDto,
  PublicPartnerResponseDto,
  UserResponseDto,
} from '../common/swagger';
import { CoursesService } from '../courses/courses.service';
import { StudentsService } from '../students/students.service';
import { UserService } from '../user/user.service';
import { PartnersService } from './partners.service';

@ApiTags('partners')
@Controller('partners')
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Get()
  @ApiOkPaginated(PublicPartnerResponseDto)
  @ResponseMessage('Partners retrieved successfully')
  findAllActive(@Query() query: PaginationQueryDto) {
    return this.partnersService.findAllActive(query);
  }

  @ApiBearerAuth()
  @RequireRole(RoleName.PARTNER)
  @UseGuards(JwtAuthGuard, RoleGuard, PermissionGuard)
  @Put('profile/me')
  @ApiOkData(PartnerResponseDto)
  @RequirePermission(PermissionResource.PARTNERS, PermissionAction.UPDATE)
  @ResponseMessage('Partner profile updated successfully')
  updateOwnProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() updatePartnerDto: UpdatePartnerDto,
  ) {
    if (!user.partnerId) {
      throw new NotFoundException('Partner profile is not linked to this account');
    }

    return this.partnersService.update(user.partnerId, updatePartnerDto);
  }

  @Get('public/:id')
  @ApiOkData(PublicPartnerResponseDto)
  @ResponseMessage('Partner retrieved successfully')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.partnersService.findOnePublic(id);
  }
}

@ApiTags('partners/portal')
@ApiBearerAuth()
@RequireRole(RoleName.PARTNER)
@UseGuards(JwtAuthGuard, RoleGuard, PermissionGuard)
@Controller('partners')
export class PartnerPortalController {
  constructor(
    private readonly partnersService: PartnersService,
    private readonly coursesService: CoursesService,
    private readonly studentsService: StudentsService,
    private readonly userService: UserService,
  ) {}

  @Put('profile/me/password')
  @SkipMustChangePasswordCheck()
  @ApiOkData(MessageResponseDto)
  @RequirePermission(PermissionResource.PARTNERS, PermissionAction.UPDATE)
  @ResponseMessage('Password changed successfully')
  changeOwnPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePartnerPasswordDto,
  ) {
    return this.partnersService.changeOwnPassword(user.id, dto);
  }

  @Get('courses/slug/:slug')
  @ApiOkData(CourseResponseDto)
  @RequirePermission(PermissionResource.PARTNERS, PermissionAction.READ)
  @ResponseMessage('Partner course retrieved successfully')
  findCourseBySlug(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug') slug: string,
  ) {
    return this.coursesService.findCourseBySlugForPartner(user.partnerId!, slug);
  }

  @Get('courses')
  @ApiOkPaginated(CourseResponseDto)
  @RequirePermission(PermissionResource.PARTNERS, PermissionAction.READ)
  @ResponseMessage('Partner courses retrieved successfully')
  findCourses(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.coursesService.findCoursesForPartner(user.partnerId!, query);
  }

  @Get('students')
  @ApiOkPaginated(UserResponseDto)
  @RequirePermission(PermissionResource.PARTNERS, PermissionAction.READ)
  @ResponseMessage('Partner students retrieved successfully')
  findStudents(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.studentsService.findStudentsForPartner(user.partnerId!, query);
  }

  @Get('enrollments')
  @ApiOkPaginated(CourseEnrollmentReportDto)
  @RequirePermission(PermissionResource.PARTNERS, PermissionAction.READ)
  @ResponseMessage('Partner enrollments retrieved successfully')
  findEnrollments(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportFilterQueryDto,
  ) {
    return this.coursesService.findEnrollmentsForPartner(
      user.partnerId!,
      query,
    );
  }

  @Get('enrollments/:id')
  @ApiOkData(CourseEnrollmentReportDto)
  @RequirePermission(PermissionResource.PARTNERS, PermissionAction.READ)
  @ResponseMessage('Partner enrollment retrieved successfully')
  findEnrollmentById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.coursesService.findEnrollmentById(id, user.partnerId!);
  }

  @Get('payments/onboarding')
  @ApiOkPaginated(PaymentTransactionResponseDto)
  @RequirePermission(PermissionResource.FINANCE, PermissionAction.READ)
  @ResponseMessage('Partner onboarding payments retrieved successfully')
  findOnboardingPayments(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportFilterQueryDto,
  ) {
    return this.coursesService.findOnboardingPayments(query, user.partnerId!);
  }

  @Get('payments/courses')
  @ApiOkPaginated(PaymentTransactionResponseDto)
  @RequirePermission(PermissionResource.FINANCE, PermissionAction.READ)
  @ResponseMessage('Partner course payments retrieved successfully')
  findCoursePayments(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReportFilterQueryDto,
  ) {
    return this.coursesService.findCoursePayments(query, user.partnerId!);
  }

  @Get('revenue')
  @ApiOkData(PartnerRevenueResponseDto)
  @RequirePermission(PermissionResource.FINANCE, PermissionAction.READ)
  @ResponseMessage('Partner revenue summary retrieved successfully')
  getRevenue(@CurrentUser() user: AuthenticatedUser) {
    return this.coursesService.getPartnerRevenueSummary(user.partnerId!);
  }

  @Get('team-users')
  @ApiOkData(UserResponseDto, { isArray: true })
  @RequirePermission(PermissionResource.PARTNERS, PermissionAction.READ)
  @ResponseMessage('Partner team users retrieved successfully')
  listTeamUsers(@CurrentUser() user: AuthenticatedUser) {
    if (!user.partnerId) {
      throw new NotFoundException('Partner profile is not linked to this account');
    }

    return this.userService.listPartnerTeamUsers(user.partnerId);
  }

  @Post('team-users')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedData(UserResponseDto)
  @RequirePermission(PermissionResource.PARTNERS, PermissionAction.UPDATE)
  @ResponseMessage('Partner team user created successfully')
  createTeamUser(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePartnerTeamUserDto,
  ) {
    if (!user.partnerId) {
      throw new NotFoundException('Partner profile is not linked to this account');
    }

    return this.userService.createPartnerTeamUser(user.partnerId, dto);
  }

  @Put('team-users/:id')
  @ApiOkData(UserResponseDto)
  @RequirePermission(PermissionResource.PARTNERS, PermissionAction.UPDATE)
  @ResponseMessage('Partner team user updated successfully')
  updateTeamUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePartnerTeamUserDto,
  ) {
    if (!user.partnerId) {
      throw new NotFoundException('Partner profile is not linked to this account');
    }

    return this.userService.updatePartnerTeamUser(user.partnerId, id, dto);
  }

  @Delete('team-users/:id')
  @ApiOkData(MessageResponseDto)
  @RequirePermission(PermissionResource.PARTNERS, PermissionAction.UPDATE)
  @ResponseMessage('Partner team user removed successfully')
  removeTeamUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!user.partnerId) {
      throw new NotFoundException('Partner profile is not linked to this account');
    }

    return this.userService.removePartnerTeamUser(user.partnerId, id);
  }
}

@ApiTags('admin/partners')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard, RoleGuard)
@Controller('admin/partners')
export class AdminPartnersController {
  constructor(
    private readonly partnersService: PartnersService,
    private readonly studentsService: StudentsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedData(CreatePartnerWithUserResponseDto)
  @RequirePermission(PermissionResource.PARTNERS, PermissionAction.CREATE)
  @ResponseMessage('Partner and login account created successfully')
  create(@Body() dto: CreatePartnerWithUserDto) {
    return this.partnersService.createWithUser(dto);
  }

  @Post('profile-only')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedData(PartnerResponseDto)
  @RequirePermission(PermissionResource.PARTNERS, PermissionAction.CREATE)
  @ResponseMessage('Partner profile created successfully')
  createProfileOnly(@Body() createPartnerDto: CreatePartnerDto) {
    return this.partnersService.create(createPartnerDto);
  }

  @Get()
  @ApiOkPaginated(PartnerResponseDto)
  @RequirePermission(PermissionResource.PARTNERS, PermissionAction.READ)
  @ResponseMessage('Partners retrieved successfully')
  findAll(@Query() query: PaginationQueryDto) {
    return this.partnersService.findAll(query);
  }

  @Get(':id/students')
  @ApiOkPaginated(UserResponseDto)
  @RequirePermission(PermissionResource.PARTNERS, PermissionAction.READ)
  @ResponseMessage('Partner students retrieved successfully')
  async findStudents(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ) {
    await this.partnersService.findOneEntity(id);
    return this.studentsService.findStudentsForPartner(id, query);
  }

  @Get(':id')
  @ApiOkData(PartnerResponseDto)
  @RequirePermission(PermissionResource.PARTNERS, PermissionAction.READ)
  @ResponseMessage('Partner retrieved successfully')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.partnersService.findOne(id);
  }

  @Put(':id')
  @ApiOkData(PartnerResponseDto)
  @RequirePermission(PermissionResource.PARTNERS, PermissionAction.UPDATE)
  @ResponseMessage('Partner updated successfully')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePartnerDto) {
    return this.partnersService.update(id, dto);
  }

  @Put(':id/fees')
  @ApiOkData(PartnerResponseDto)
  @RequireRole(RoleName.SUPERADMIN)
  @RequirePermission(PermissionResource.PARTNERS, PermissionAction.UPDATE)
  @ResponseMessage('Partner fees updated successfully')
  updateFees(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePartnerFeesDto,
  ) {
    return this.partnersService.updateFees(id, dto);
  }

  @Put(':id/disable')
  @ApiOkData(PartnerResponseDto)
  @RequirePermission(PermissionResource.PARTNERS, PermissionAction.UPDATE)
  @ResponseMessage('Partner disabled successfully')
  disable(@Param('id', ParseUUIDPipe) id: string) {
    return this.partnersService.disable(id);
  }

  @Post(':id/resend-welcome-email')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOkData(MessageResponseDto)
  @RequirePermission(PermissionResource.PARTNERS, PermissionAction.UPDATE)
  @ResponseMessage('Welcome email has been queued')
  resendWelcomeEmail(@Param('id', ParseUUIDPipe) id: string) {
    return this.partnersService.resendWelcomeEmail(id);
  }
}
