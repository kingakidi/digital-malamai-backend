import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateStaffUserDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    minLength: 8,
    description:
      'Optional. If omitted, a secure temporary password is generated and emailed.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password?: string;

  @ApiProperty({ description: 'Staff role ID from /roles (admin or manager)' })
  @IsUUID()
  roleId: string;
}
