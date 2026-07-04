import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { CreatePartnerDto } from './create-partner.dto';

export class CreatePartnerWithUserDto extends CreatePartnerDto {
  @ApiProperty({ minLength: 8, description: 'Password for the partner login account' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}
