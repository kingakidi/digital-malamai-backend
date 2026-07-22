import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import {
  ApiOkData,
  CourseWithEnrollmentResponseDto,
} from '../common/swagger';
import { CoursesService } from './courses.service';

@ApiTags('courses')
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @ApiOkData(CourseWithEnrollmentResponseDto, { isArray: true })
  @ResponseMessage('Courses retrieved successfully')
  listPublished() {
    return this.coursesService.findPublishedCoursesPublic();
  }

  @Get('slug/:slug')
  @ApiOkData(CourseWithEnrollmentResponseDto)
  @ResponseMessage('Course retrieved successfully')
  findBySlug(@Param('slug') slug: string) {
    return this.coursesService.findPublishedCourseBySlugPublic(slug);
  }

  @Get(':id')
  @ApiOkData(CourseWithEnrollmentResponseDto)
  @ResponseMessage('Course retrieved successfully')
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.coursesService.findPublishedCoursePublic(id);
  }
}
