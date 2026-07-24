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
import { RequireRole } from '../common/abac/decorators/require-role.decorator';
import { JwtAuthGuard } from '../common/abac/guards/jwt-auth.guard';
import { RoleGuard } from '../common/abac/guards/role.guard';
import { STAFF_COURSE_ROLES } from '../common/constants/staff-roles.constants';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import {
  ApiCreatedData,
  ApiOkData,
  ApiOkNull,
  ApiOkPaginated,
  CourseCategoryResponseDto,
} from '../common/swagger';
import { RoleName } from '../common/types/permission.types';
import { CourseCategoriesService } from './course-categories.service';
import { CreateCourseCategoryDto } from './dto/create-course-category.dto';
import { UpdateCourseCategoryDto } from './dto/update-course-category.dto';

@ApiTags('admin/course-categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('admin/course-categories')
export class AdminCourseCategoriesController {
  constructor(
    private readonly courseCategoriesService: CourseCategoriesService,
  ) {}

  @Get()
  @RequireRole(...STAFF_COURSE_ROLES, RoleName.ADMIN, RoleName.SUPERADMIN)
  @ApiOkPaginated(CourseCategoryResponseDto)
  @ResponseMessage('Course categories retrieved successfully')
  findAll(@Query() query: PaginationQueryDto) {
    return this.courseCategoriesService.findAll(query);
  }

  @Get('options')
  @RequireRole(...STAFF_COURSE_ROLES, RoleName.ADMIN, RoleName.SUPERADMIN)
  @ApiOkData(CourseCategoryResponseDto, { isArray: true })
  @ResponseMessage('Course category options retrieved successfully')
  listOptions() {
    return this.courseCategoriesService.listAll();
  }

  @Get(':id')
  @RequireRole(RoleName.SUPERADMIN, RoleName.ADMIN)
  @ApiOkData(CourseCategoryResponseDto)
  @ResponseMessage('Course category retrieved successfully')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.courseCategoriesService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireRole(RoleName.SUPERADMIN, RoleName.ADMIN)
  @ApiCreatedData(CourseCategoryResponseDto)
  @ResponseMessage('Course category created successfully')
  create(@Body() dto: CreateCourseCategoryDto) {
    return this.courseCategoriesService.create(dto);
  }

  @Put(':id')
  @RequireRole(RoleName.SUPERADMIN, RoleName.ADMIN)
  @ApiOkData(CourseCategoryResponseDto)
  @ResponseMessage('Course category updated successfully')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCourseCategoryDto,
  ) {
    return this.courseCategoriesService.update(id, dto);
  }

  @Delete(':id')
  @RequireRole(RoleName.SUPERADMIN, RoleName.ADMIN)
  @ApiOkNull()
  @ResponseMessage('Course category deleted successfully')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.courseCategoriesService.remove(id);
    return null;
  }
}
