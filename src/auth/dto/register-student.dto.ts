import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

export class RegisterStudentDto {
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Optional partner affiliation at signup',
  })
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : value,
  )
  @IsOptional()
  @IsUUID()
  partnerId?: string;

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
