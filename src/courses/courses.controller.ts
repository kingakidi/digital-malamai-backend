import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/abac/decorators/current-user.decorator';
import { RequireRole } from '../common/abac/decorators/require-role.decorator';
import { JwtAuthGuard } from '../common/abac/guards/jwt-auth.guard';
import { RoleGuard } from '../common/abac/guards/role.guard';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { RoleName } from '../common/types/permission.types';
import {
  ApiOkData,
  CourseWithEnrollmentResponseDto,
} from '../common/swagger';
import { CoursesService } from './courses.service';

@ApiTags('courses')
@ApiBearerAuth()
@RequireRole(RoleName.STUDENT)
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @ApiOkData(CourseWithEnrollmentResponseDto, { isArray: true })
  @ResponseMessage('Courses retrieved successfully')
  listForStudent(@CurrentUser() user: AuthenticatedUser) {
    return this.coursesService.findPublishedCoursesForStudent(user.id, user.partnerId);
  }

  @Get('slug/:slug')
  @ApiOkData(CourseWithEnrollmentResponseDto)
  @ResponseMessage('Course retrieved successfully')
  findBySlug(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug') slug: string,
  ) {
    return this.coursesService.findPublishedCourseBySlugForStudent(
      slug,
      user.id,
      user.partnerId,
    );
  }

  @Get(':id')
  @ApiOkData(CourseWithEnrollmentResponseDto)
  @ResponseMessage('Course retrieved successfully')
  findById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.coursesService.findPublishedCourseForStudent(
      id,
      user.id,
      user.partnerId,
    );
  }
}
