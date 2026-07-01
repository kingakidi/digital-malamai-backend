import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsString } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'support_lead' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Support Lead' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: ['users:read:all', 'users:update:all', 'roles:read:all'],
    description:
      'Permission keys from GET /roles/permissions/groups — grouped like GitHub role permissions',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  permissionKeys: string[];
}
