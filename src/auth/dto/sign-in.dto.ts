import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SignInDto {
  @ApiProperty({
    description: 'Email address (or phone number) of the account',
    example: 'user@example.com',
  })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description:
      'Account password, or the 6-character access code for students who have not set one',
    example: 'Secret123!',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
