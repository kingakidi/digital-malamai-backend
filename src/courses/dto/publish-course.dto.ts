import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { CourseStatus } from '../../common/types/payment.types';

export class PublishCourseDto {
  @ApiProperty({ enum: [CourseStatus.PUBLISHED, CourseStatus.DRAFT] })
  @IsEnum(CourseStatus)
  status: CourseStatus.PUBLISHED | CourseStatus.DRAFT;
}
