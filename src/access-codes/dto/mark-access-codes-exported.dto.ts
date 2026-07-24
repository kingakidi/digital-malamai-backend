import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, Length } from 'class-validator';
import { MAX_ACCESS_CODES_EXPORT } from '../constants/access-codes.constants';

export class MarkAccessCodesExportedDto {
  @ApiProperty({
    type: [String],
    description: 'Access code values to mark as exported',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ACCESS_CODES_EXPORT)
  @IsString({ each: true })
  @Length(6, 6, { each: true })
  codes: string[];
}
