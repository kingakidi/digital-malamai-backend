import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { CreatePartnerDto } from './create-partner.dto';

export class CreatePartnerWithUserDto extends CreatePartnerDto {
  @ApiPropertyOptional({
    minLength: 8,
    description:
      'Optional. If omitted, a secure temporary password is generated and emailed to the partner.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password?: string;
}
