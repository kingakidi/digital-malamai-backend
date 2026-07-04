import { ApiProperty } from '@nestjs/swagger';

export class ApiErrorResponseDto {
  @ApiProperty({ example: false })
  status: false;

  @ApiProperty({ example: 'Validation failed' })
  message: string;

  @ApiProperty({
    oneOf: [
      { type: 'string', example: 'email must be an email' },
      {
        type: 'array',
        items: { type: 'string' },
        example: ['email must be an email', 'password must be longer than 8 characters'],
      },
    ],
  })
  error: string | string[];
}

export class ApiSuccessResponseBaseDto {
  @ApiProperty({ example: true })
  status: true;

  @ApiProperty({ example: 'Success' })
  message: string;
}

export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 3 })
  totalPages: number;

  @ApiProperty({ example: true })
  hasNextPage: boolean;

  @ApiProperty({ example: false })
  hasPreviousPage: boolean;
}
