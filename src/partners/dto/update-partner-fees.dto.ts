import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { CommissionType } from '../../common/types/payment.types';

export class UpdatePartnerFeesDto {
  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  onboardingFee?: number | null;

  @ApiPropertyOptional({ enum: CommissionType })
  @IsOptional()
  @IsEnum(CommissionType)
  commissionType?: CommissionType | null;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  commissionValue?: number | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, deprecated: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  onboardPercentage?: number;
}
