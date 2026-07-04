import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class StudentSignInDto {
  @ApiProperty({
    description: 'Student email or phone number',
    example: 'student@example.com',
  })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({
    description: 'Custom password if set, otherwise the 6-character access code',
    example: 'ABC123',
  })
  @IsString()
  @IsNotEmpty()
  credential: string;
}
