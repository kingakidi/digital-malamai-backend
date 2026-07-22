import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { STAFF_COURSE_ROLES } from '../common/constants/staff-roles.constants';
import { RequireRole } from '../common/abac/decorators/require-role.decorator';
import { JwtAuthGuard } from '../common/abac/guards/jwt-auth.guard';
import { RoleGuard } from '../common/abac/guards/role.guard';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { RoleName } from '../common/types/permission.types';
import { CreateCourseDto } from './dto/create-course.dto';
import { PublishCourseDto } from './dto/publish-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import {
  ApiCreatedData,
  ApiOkData,
  ApiOkNull,
  ApiOkPaginated,
  CourseResponseDto,
} from '../common/swagger';
import { CoursesService } from './courses.service';

@ApiTags('admin/courses')
@ApiBearerAuth()
@RequireRole(...STAFF_COURSE_ROLES)
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('admin/courses')
export class AdminCoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @RequireRole(RoleName.SUPERADMIN, RoleName.ADMIN)
  @ApiOkPaginated(CourseResponseDto)
  @ResponseMessage('Courses retrieved successfully')
  findAll(@Query() query: PaginationQueryDto) {
    return this.coursesService.findAllCourses(query);
  }

  @Get('slug/:slug')
  @RequireRole(RoleName.SUPERADMIN, RoleName.ADMIN)
  @ApiOkData(CourseResponseDto)
  @ResponseMessage('Course retrieved successfully')
  findBySlug(@Param('slug') slug: string) {
    return this.coursesService.findCourseBySlugForStaff(slug);
  }

  @Get(':id')
  @RequireRole(RoleName.SUPERADMIN, RoleName.ADMIN)
  @ApiOkData(CourseResponseDto)
  @ResponseMessage('Course retrieved successfully')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.coursesService.findCourseById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedData(CourseResponseDto)
  @ResponseMessage('Course created successfully')
  create(@Body() dto: CreateCourseDto) {
    return this.coursesService.createCourse(dto);
  }

  @Put(':id')
  @ApiOkData(CourseResponseDto)
  @ResponseMessage('Course updated successfully')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCourseDto) {
    return this.coursesService.updateCourse(id, dto);
  }

  @Put(':id/publish')
  @ApiOkData(CourseResponseDto)
  @ResponseMessage('Course publish status updated successfully')
  publish(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PublishCourseDto) {
    return this.coursesService.publishCourse(id, dto);
  }

  @Put(':id/disable')
  @ApiOkData(CourseResponseDto)
  @ResponseMessage('Course disabled successfully')
  disable(@Param('id', ParseUUIDPipe) id: string) {
    return this.coursesService.disableCourse(id);
  }

  @Delete(':id')
  @ApiOkNull()
  @ResponseMessage('Course deleted successfully')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.coursesService.removeCourse(id);
  }
}

@ApiTags('courses')
@ApiBearerAuth()
@RequireRole(...STAFF_COURSE_ROLES)
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('courses')
export class StaffCoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedData(CourseResponseDto)
  @ResponseMessage('Course created successfully')
  create(@Body() dto: CreateCourseDto) {
    return this.coursesService.createCourse(dto);
  }

  @Put(':id')
  @ApiOkData(CourseResponseDto)
  @ResponseMessage('Course updated successfully')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCourseDto) {
    return this.coursesService.updateCourse(id, dto);
  }

  @Put(':id/publish')
  @ApiOkData(CourseResponseDto)
  @ResponseMessage('Course publish status updated successfully')
  publish(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PublishCourseDto) {
    return this.coursesService.publishCourse(id, dto);
  }

  @Put(':id/disable')
  @ApiOkData(CourseResponseDto)
  @ResponseMessage('Course disabled successfully')
  disable(@Param('id', ParseUUIDPipe) id: string) {
    return this.coursesService.disableCourse(id);
  }
}
