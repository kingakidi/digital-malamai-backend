import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateFlagSettingDto {
  @ApiProperty()
  @IsBoolean()
  enabled: boolean;
}

export class FlagSettingResponseDto {
  @ApiProperty()
  key: string;

  @ApiProperty()
  enabled: boolean;

  @ApiProperty()
  updatedAt: Date;
}

export class CourseDeliverySettingsResponseDto {
  @ApiProperty({
    description: 'When true, enrolled students can watch lessons in-app',
  })
  watchInApp: boolean;

  @ApiProperty({ description: 'Email delivery is always enabled' })
  email: true;

  @ApiProperty({
    description: 'When true, course links are also sent via WhatsApp',
  })
  whatsapp: boolean;
}
