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
}
