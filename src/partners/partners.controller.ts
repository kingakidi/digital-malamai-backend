import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/abac/decorators/current-user.decorator';
import { RequirePermission } from '../common/abac/decorators/require-permission.decorator';
import { RequireRole } from '../common/abac/decorators/require-role.decorator';
import { JwtAuthGuard } from '../common/abac/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/abac/guards/permission.guard';
import { RoleGuard } from '../common/abac/guards/role.guard';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  PermissionAction,
  PermissionResource,
  RoleName,
} from '../common/types/permission.types';
import { CreatePartnerWithUserDto } from './dto/create-partner-with-user.dto';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerFeesDto } from './dto/update-partner-fees.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import {
  ApiCreatedData,
  ApiOkData,
  ApiOkPaginated,
  CourseResponseDto,
  CreatePartnerWithUserResponseDto,
  PartnerResponseDto,
  PartnerRevenueResponseDto,
  UserResponseDto,
} from '../common/swagger';
import { CoursesService } from '../courses/courses.service';
import { StudentsService } from '../students/students.service';
import { PartnersService } from './partners.service';

@ApiTags('partners')
@Controller('partners')
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Get()
  @ApiOkPaginated(PartnerResponseDto)
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
    return this.partnersService.update(user.partnerId!, updatePartnerDto);
  }

  @Get(':id')
  @ApiOkData(PartnerResponseDto)
  @ResponseMessage('Partner retrieved successfully')
  findOne(@Param('id') id: string) {
    return this.partnersService.findOne(id);
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
  ) {}

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

  @Get('revenue')
  @ApiOkData(PartnerRevenueResponseDto)
  @RequirePermission(PermissionResource.FINANCE, PermissionAction.READ)
  @ResponseMessage('Partner revenue summary retrieved successfully')
  getRevenue(@CurrentUser() user: AuthenticatedUser) {
    return this.coursesService.getPartnerRevenueSummary(user.partnerId!);
  }
}

@ApiTags('admin/partners')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard, RoleGuard)
@Controller('admin/partners')
export class AdminPartnersController {
  constructor(private readonly partnersService: PartnersService) {}

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

  @Get(':id')
  @ApiOkData(PartnerResponseDto)
  @RequirePermission(PermissionResource.PARTNERS, PermissionAction.READ)
  @ResponseMessage('Partner retrieved successfully')
  findOne(@Param('id') id: string) {
    return this.partnersService.findOne(id);
  }

  @Patch(':id')
  @ApiOkData(PartnerResponseDto)
  @RequirePermission(PermissionResource.PARTNERS, PermissionAction.UPDATE)
  @ResponseMessage('Partner updated successfully')
  update(@Param('id') id: string, @Body() dto: UpdatePartnerDto) {
    return this.partnersService.update(id, dto);
  }

  @Patch(':id/fees')
  @ApiOkData(PartnerResponseDto)
  @RequireRole(RoleName.SUPERADMIN)
  @RequirePermission(PermissionResource.PARTNERS, PermissionAction.UPDATE)
  @ResponseMessage('Partner fees updated successfully')
  updateFees(@Param('id') id: string, @Body() dto: UpdatePartnerFeesDto) {
    return this.partnersService.updateFees(id, dto);
  }

  @Patch(':id/disable')
  @ApiOkData(PartnerResponseDto)
  @RequirePermission(PermissionResource.PARTNERS, PermissionAction.UPDATE)
  @ResponseMessage('Partner disabled successfully')
  disable(@Param('id') id: string) {
    return this.partnersService.disable(id);
  }
}
