import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, Length, Matches } from 'class-validator';
import { OtpChannel } from '../../common/types/otp.types';

export class VerifyOtpDto {
  @ApiProperty({ enum: OtpChannel, example: OtpChannel.EMAIL })
  @IsEnum(OtpChannel)
  type: OtpChannel;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d+$/)
  code: string;
}
