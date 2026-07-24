import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { AccessCodeExportMode } from './export-unused-access-codes.dto';

/** Dedicated export browse pagination — larger page size than the normal admin list. */
export class AccessCodesForExportQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    default: 100,
    minimum: 1,
    maximum: 100,
    description: 'Page size for export browsing (default/max 100)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 100;

  @ApiPropertyOptional({
    enum: AccessCodeExportMode,
    default: AccessCodeExportMode.READY,
  })
  @IsOptional()
  @IsEnum(AccessCodeExportMode)
  mode?: AccessCodeExportMode = AccessCodeExportMode.READY;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
