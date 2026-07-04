import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export class RegisterStudentDto {
  @ApiProperty()
  @IsUUID()
  partnerId: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'ABC123' })
  @IsString()
  @Length(6, 6)
  @Matches(/^[A-Za-z0-9]+$/)
  accessCode: string;
}
