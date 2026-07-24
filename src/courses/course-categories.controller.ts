import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { ApiOkData, CourseCategoryResponseDto } from '../common/swagger';
import { CourseCategoriesService } from './course-categories.service';

@ApiTags('course-categories')
@Controller('course-categories')
export class CourseCategoriesController {
  constructor(
    private readonly courseCategoriesService: CourseCategoriesService,
  ) {}

  @Get()
  @ApiOkData(CourseCategoryResponseDto, { isArray: true })
  @ResponseMessage('Course categories retrieved successfully')
  listPublic() {
    return this.courseCategoriesService.listPublic();
  }
}
