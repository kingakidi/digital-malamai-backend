import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { RequireRole } from '../common/abac/decorators/require-role.decorator';
import { JwtAuthGuard } from '../common/abac/guards/jwt-auth.guard';
import { RoleGuard } from '../common/abac/guards/role.guard';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import {
  ApiCreatedData,
  ApiOkNull,
  ApiOkPaginated,
} from '../common/swagger';
import { RoleName } from '../common/types/permission.types';
import { SubscribeNewsletterDto } from './dto/subscribe-newsletter.dto';
import { NewsletterService } from './newsletter.service';

export class NewsletterSubscriberResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

@ApiTags('newsletter')
@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Post('subscribe')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiCreatedData(NewsletterSubscriberResponseDto)
  @ResponseMessage('Subscribed to newsletter successfully')
  subscribe(@Body() dto: SubscribeNewsletterDto) {
    return this.newsletterService.subscribe(dto);
  }
}

@ApiTags('admin/newsletter')
@ApiBearerAuth()
@RequireRole(RoleName.SUPERADMIN, RoleName.ADMIN)
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('admin/newsletter')
export class AdminNewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Get()
  @ApiOkPaginated(NewsletterSubscriberResponseDto)
  @ResponseMessage('Newsletter subscribers retrieved successfully')
  findAll(@Query() query: PaginationQueryDto) {
    return this.newsletterService.findAll(query);
  }

  @Delete(':id')
  @ApiOkNull()
  @ResponseMessage('Newsletter subscriber deleted successfully')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.newsletterService.remove(id);
  }
}
