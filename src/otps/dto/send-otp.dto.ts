import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { OtpChannel } from '../../common/types/otp.types';

export class SendOtpDto {
  @ApiProperty({ enum: OtpChannel, example: OtpChannel.EMAIL })
  @IsEnum(OtpChannel)
  type: OtpChannel;
}
