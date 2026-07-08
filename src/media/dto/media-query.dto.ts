import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { UPLOAD_FOLDERS } from '../media.config';

const UPLOAD_FOLDER_VALUES = Object.values(UPLOAD_FOLDERS);

export class UploadMediaQueryDto {
  @ApiPropertyOptional({
    enum: UPLOAD_FOLDER_VALUES,
    example: UPLOAD_FOLDERS.PARTNERS,
  })
  @IsOptional()
  @IsIn(UPLOAD_FOLDER_VALUES)
  folder?: string;
}

export class MediaKeyQueryDto {
  @ApiPropertyOptional({ example: 'partners/logo-1234567890-abc123.png' })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiPropertyOptional({
    description: 'Return JSON `{ url }` instead of redirecting',
    example: 'true',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  json?: boolean;

  @ApiPropertyOptional({
    description: 'Presigned URL expiry in seconds (60-604800)',
    example: 3600,
  })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(60)
  @Max(604800)
  expiresIn?: number;
}

export class DeleteMediaQueryDto {
  @ApiPropertyOptional({ example: 'partners/logo-1234567890-abc123.png' })
  @IsString()
  @IsNotEmpty()
  key!: string;
}
