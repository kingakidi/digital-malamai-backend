import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EnrollFreeCoursesDto {
  @ApiProperty({
    type: [String],
    description: 'Course IDs to enroll in for free (must all be free / zero-priced)',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  courseIds: string[];
}
