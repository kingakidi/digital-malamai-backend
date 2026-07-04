import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { OtpChannel } from '../../common/types/otp.types';

export class ForgotPasswordSendDto {
  @ApiProperty({
    description: 'Student email or phone number',
    example: 'student@example.com',
  })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({ enum: OtpChannel, example: OtpChannel.EMAIL })
  @IsEnum(OtpChannel)
  type: OtpChannel;
}
