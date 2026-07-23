import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class VerifyPaymentDto {
  @ApiPropertyOptional({ description: 'Flutterwave transaction ID' })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiPropertyOptional({ description: 'Flutterwave tx_ref from checkout' })
  @IsOptional()
  @IsString()
  txRef?: string;

  @ApiPropertyOptional({ description: 'onboarding | course' })
  @IsOptional()
  @IsString()
  paidFor?: string;

  @ApiPropertyOptional({ description: 'Primary course id for course payments' })
  @IsOptional()
  @IsString()
  courseId?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated course ids for cart checkout',
  })
  @IsOptional()
  @IsString()
  courseIds?: string;
}
