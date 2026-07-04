import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { MAX_ACCESS_CODES_PER_REQUEST } from '../constants/access-codes.constants';

export class GenerateAccessCodesDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_ACCESS_CODES_PER_REQUEST,
    default: 1,
    description: `Number of access codes to generate (max ${MAX_ACCESS_CODES_PER_REQUEST})`,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_ACCESS_CODES_PER_REQUEST)
  count?: number = 1;
}
