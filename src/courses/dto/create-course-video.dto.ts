import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  ValidateIf,
} from 'class-validator';
import { CourseResourceType } from '../enums/course-resource-type.enum';

export class CreateCourseVideoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'URL for the lesson resource (video, document, or image)',
  })
  @IsUrl({}, { message: 'resource URL must be a valid URL' })
  vimeoUrl: string;

  @ApiPropertyOptional({
    enum: CourseResourceType,
    default: CourseResourceType.VIDEO,
  })
  @IsOptional()
  @IsEnum(CourseResourceType)
  resourceType?: CourseResourceType;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({
    default: 0,
    description: 'Lesson duration in minutes (video resources only)',
  })
  @ValidateIf(
    (dto: CreateCourseVideoDto) =>
      (dto.resourceType ?? CourseResourceType.VIDEO) ===
      CourseResourceType.VIDEO,
  )
  @IsOptional()
  @IsInt()
  @Min(0)
  duration?: number;

  @ApiPropertyOptional({ description: 'Rich-text lesson notes' })
  @IsOptional()
  @IsString()
  details?: string | null;
}
