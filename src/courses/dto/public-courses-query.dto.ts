import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class PublicCoursesQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by category slug or category UUID',
    example: 'microsoft-office-proficiency',
  })
  @IsOptional()
  @IsString()
  category?: string;
}
