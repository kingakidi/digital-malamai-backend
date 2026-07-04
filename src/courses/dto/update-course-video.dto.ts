import { PartialType } from '@nestjs/swagger';
import { CreateCourseVideoDto } from './create-course-video.dto';

export class UpdateCourseVideoDto extends PartialType(CreateCourseVideoDto) {}
