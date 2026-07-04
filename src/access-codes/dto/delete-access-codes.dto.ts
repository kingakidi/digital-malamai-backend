import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class DeleteAccessCodesDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'Specific unused access code IDs to delete',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @IsUUID('4', { each: true })
  ids?: string[];

  @ApiPropertyOptional({
    description:
      'When true, deletes all unused codes for the partner (ignores ids)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  deleteAllUnused?: boolean;
}
