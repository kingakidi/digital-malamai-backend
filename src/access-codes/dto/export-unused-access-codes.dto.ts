import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';
import { MAX_ACCESS_CODES_EXPORT } from '../constants/access-codes.constants';

export class ExportUnusedAccessCodesDto {
  @ApiProperty({
    minimum: 1,
    maximum: MAX_ACCESS_CODES_EXPORT,
    description: `Number of unused, not-yet-exported codes to export (max ${MAX_ACCESS_CODES_EXPORT})`,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ACCESS_CODES_EXPORT)
  count: number;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Only codes created on/after this date (createdAt ASC)',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Only codes created on/before this date (createdAt ASC)',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
