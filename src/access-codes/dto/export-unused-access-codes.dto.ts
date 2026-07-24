import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { MAX_ACCESS_CODES_EXPORT } from '../constants/access-codes.constants';

export class ExportUnusedAccessCodesDto {
  @ApiProperty({
    minimum: 1,
    maximum: MAX_ACCESS_CODES_EXPORT,
    description: `Number of unused access codes to export (max ${MAX_ACCESS_CODES_EXPORT})`,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ACCESS_CODES_EXPORT)
  count: number;
}
