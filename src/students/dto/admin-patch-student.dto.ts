import { AccountStatus } from '../../common/types/account-status.type';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class AdminPatchStudentDto {
  @ApiProperty({ enum: AccountStatus })
  @IsEnum(AccountStatus)
  accountStatus: AccountStatus;
}
