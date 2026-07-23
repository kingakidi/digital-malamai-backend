import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { PaidFor } from '../../common/types/payment.types';

export class CheckPaymentEligibilityDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ enum: PaidFor, example: PaidFor.ONBOARDING })
  @IsEnum(PaidFor)
  paidFor: PaidFor;

  @ApiPropertyOptional({
    description: 'Optional when paidFor is onboarding',
    format: 'uuid',
  })
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : value,
  )
  @IsOptional()
  @IsUUID()
  partnerId?: string;

  @ApiPropertyOptional({
    description: 'Required when paidFor is course',
    format: 'uuid',
  })
  @ValidateIf((dto: CheckPaymentEligibilityDto) => dto.paidFor === PaidFor.COURSE)
  @IsUUID()
  courseId?: string;
}
