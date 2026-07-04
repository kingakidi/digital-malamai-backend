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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/abac/decorators/current-user.decorator';
import { RequireRole } from '../common/abac/decorators/require-role.decorator';
import { JwtAuthGuard } from '../common/abac/guards/jwt-auth.guard';
import { RoleGuard } from '../common/abac/guards/role.guard';
import { STAFF_COURSE_ROLES } from '../common/constants/staff-roles.constants';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { RoleName } from '../common/types/permission.types';
import {
  ApiCreatedData,
  ApiNoContentData,
  ApiOkData,
  CourseVideoResponseDto,
} from '../common/swagger';
import { CoursesService } from './courses.service';
import { CreateCourseVideoDto } from './dto/create-course-video.dto';
import { UpdateCourseVideoDto } from './dto/update-course-video.dto';

@ApiTags('courses/videos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('courses/:courseId/videos')
export class CourseVideosController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @ApiOkData(CourseVideoResponseDto, { isArray: true })
  @RequireRole(RoleName.STUDENT, ...STAFF_COURSE_ROLES)
  @ResponseMessage('Course videos retrieved successfully')
  list(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.coursesService.getCourseVideosForUser(
      courseId,
      user.id,
      user.role.name as RoleName,
    );
  }

  @Post()
  @RequireRole(...STAFF_COURSE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedData(CourseVideoResponseDto)
  @ResponseMessage('Course video added successfully')
  create(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: CreateCourseVideoDto,
  ) {
    return this.coursesService.addCourseVideo(courseId, dto);
  }

  @Put(':videoId')
  @ApiOkData(CourseVideoResponseDto)
  @RequireRole(...STAFF_COURSE_ROLES)
  @ResponseMessage('Course video updated successfully')
  update(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('videoId', ParseUUIDPipe) videoId: string,
    @Body() dto: UpdateCourseVideoDto,
  ) {
    return this.coursesService.updateCourseVideo(courseId, videoId, dto);
  }

  @Delete(':videoId')
  @ApiNoContentData()
  @RequireRole(...STAFF_COURSE_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseMessage('Course video removed successfully')
  async remove(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('videoId', ParseUUIDPipe) videoId: string,
  ) {
    await this.coursesService.removeCourseVideo(courseId, videoId);
  }
}
