import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';
import { VerifyPaymentDto } from './verify-payment.dto';

export class VerifyOnboardingPaymentDto extends VerifyPaymentDto {
  @ApiPropertyOptional({
    description:
      'Fallback registration email when Flutterwave metadata is missing',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description:
      'Optional fallback partner id when Flutterwave metadata is missing',
  })
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : value,
  )
  @IsOptional()
  @IsUUID()
  partnerId?: string;

  @ApiPropertyOptional({
    description:
      'Fallback access code when Flutterwave metadata is missing',
  })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  @Matches(/^[A-Za-z0-9]+$/)
  accessCode?: string;

  @ApiPropertyOptional({
    description:
      'Fallback full name when Flutterwave metadata is missing',
  })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({
    description:
      'Fallback phone when Flutterwave metadata is missing',
  })
  @IsOptional()
  @IsString()
  phone?: string;
}
