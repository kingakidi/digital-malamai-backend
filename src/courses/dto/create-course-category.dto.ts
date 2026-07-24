import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCourseCategoryDto {
  @ApiProperty({ example: 'Microsoft Office Proficiency' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    example: 'microsoft-office-proficiency',
    description: 'URL slug; auto-generated from name when omitted',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @ApiPropertyOptional({
    description: 'Optional category icon/image URL (upload to categories folder)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  iconUrl?: string | null;
}
