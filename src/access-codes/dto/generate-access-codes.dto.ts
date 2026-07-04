import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class GenerateAccessCodesDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: 50,
    default: 1,
    description: 'Number of access codes to generate',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  count?: number = 1;
}
