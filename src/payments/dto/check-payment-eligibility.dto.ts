import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
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
    description: 'Required when paidFor is onboarding',
    format: 'uuid',
  })
  @ValidateIf((dto: CheckPaymentEligibilityDto) => dto.paidFor === PaidFor.ONBOARDING)
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
