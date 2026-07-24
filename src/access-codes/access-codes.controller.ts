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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../common/abac/decorators/current-user.decorator';
import { RequirePermission } from '../common/abac/decorators/require-permission.decorator';
import { RequireRole } from '../common/abac/decorators/require-role.decorator';
import { JwtAuthGuard } from '../common/abac/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/abac/guards/permission.guard';
import { RoleGuard } from '../common/abac/guards/role.guard';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  PermissionAction,
  PermissionResource,
  RoleName,
} from '../common/types/permission.types';
import {
  ApiCreatedData,
  ApiOkData,
  ApiOkPaginated,
  AccessCodeResponseDto,
  AccessCodeStatsResponseDto,
  DeleteAccessCodesResultDto,
  ExportUnusedAccessCodesResultDto,
  MarkAccessCodesExportedResultDto,
  GenerateAccessCodesResultDto,
} from '../common/swagger';
import { DeleteAccessCodesDto } from './dto/delete-access-codes.dto';
import { AccessCodesForExportQueryDto } from './dto/access-codes-for-export-query.dto';
import { ExportUnusedAccessCodesDto } from './dto/export-unused-access-codes.dto';
import { GenerateAccessCodesDto } from './dto/generate-access-codes.dto';
import { MarkAccessCodesExportedDto } from './dto/mark-access-codes-exported.dto';
import { AccessCodesService } from './access-codes.service';

@ApiTags('partners/access-codes')
@ApiBearerAuth()
@RequireRole(RoleName.PARTNER)
@UseGuards(JwtAuthGuard, RoleGuard, PermissionGuard)
@Controller('partners/access-codes')
export class PartnerAccessCodesController {
  constructor(private readonly accessCodesService: AccessCodesService) {}

  @Get()
  @ApiOkPaginated(AccessCodeResponseDto)
  @RequirePermission(PermissionResource.ACCESS_CODES, PermissionAction.READ)
  @ResponseMessage('Access codes retrieved successfully')
  findOwn(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.accessCodesService.findForPartner(user.partnerId!, query);
  }

  @Get('stats')
  @ApiOkData(AccessCodeStatsResponseDto)
  @RequirePermission(PermissionResource.ACCESS_CODES, PermissionAction.READ)
  @ResponseMessage('Access code stats retrieved successfully')
  getStats(@CurrentUser() user: AuthenticatedUser) {
    return this.accessCodesService.getStatsForPartner(user.partnerId!);
  }

  @Get(':id')
  @ApiOkData(AccessCodeResponseDto)
  @RequirePermission(PermissionResource.ACCESS_CODES, PermissionAction.READ)
  @ResponseMessage('Access code retrieved successfully')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.accessCodesService.findOneForPartner(user.partnerId!, id);
  }
}

@ApiTags('admin/access-codes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard, RoleGuard)
@Controller('admin/access-codes')
export class AdminGlobalAccessCodesController {
  constructor(private readonly accessCodesService: AccessCodesService) {}

  @Get()
  @ApiOkPaginated(AccessCodeResponseDto)
  @RequirePermission(PermissionResource.ACCESS_CODES, PermissionAction.READ)
  @ResponseMessage('Access codes retrieved successfully')
  findAll(@Query() query: PaginationQueryDto) {
    return this.accessCodesService.findAll(query);
  }

  @Get('stats')
  @ApiOkData(AccessCodeStatsResponseDto)
  @RequirePermission(PermissionResource.ACCESS_CODES, PermissionAction.READ)
  @ResponseMessage('Access code stats retrieved successfully')
  getStats() {
    return this.accessCodesService.getStats();
  }

  /**
   * Dedicated export browse route (limit default/max 100). Not rate-limited.
   * Do not use GET /admin/access-codes for bulk export paging.
   */
  @SkipThrottle({ default: true })
  @Get('for-export')
  @ApiOkPaginated(AccessCodeResponseDto)
  @RequirePermission(PermissionResource.ACCESS_CODES, PermissionAction.READ)
  @ResponseMessage('Ready access codes retrieved successfully')
  findReadyForExport(@Query() query: AccessCodesForExportQueryDto) {
    return this.accessCodesService.findReadyCodesForExport(query);
  }

  /** Single-request bulk export; marks codes exported. Not rate-limited. */
  @SkipThrottle({ default: true })
  @Get('export')
  @ApiOkData(ExportUnusedAccessCodesResultDto)
  @RequirePermission(PermissionResource.ACCESS_CODES, PermissionAction.READ)
  @ResponseMessage('Unused access codes exported successfully')
  exportUnused(@Query() query: ExportUnusedAccessCodesDto) {
    return this.accessCodesService.listUnusedCodesForExport(query);
  }

  @SkipThrottle({ default: true })
  @Post('mark-exported')
  @ApiOkData(MarkAccessCodesExportedResultDto)
  @RequirePermission(PermissionResource.ACCESS_CODES, PermissionAction.READ)
  @ResponseMessage('Access codes marked as exported successfully')
  markExported(@Body() dto: MarkAccessCodesExportedDto) {
    return this.accessCodesService.markCodesExported(dto.codes);
  }

  @Get(':id')
  @ApiOkData(AccessCodeResponseDto)
  @RequirePermission(PermissionResource.ACCESS_CODES, PermissionAction.READ)
  @ResponseMessage('Access code retrieved successfully')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.accessCodesService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedData(GenerateAccessCodesResultDto)
  @RequireRole(RoleName.SUPERADMIN)
  @RequirePermission(PermissionResource.ACCESS_CODES, PermissionAction.CREATE)
  @ResponseMessage('Access codes generated successfully')
  generate(@Body() dto: GenerateAccessCodesDto) {
    return this.accessCodesService.generate(dto);
  }

  @Delete()
  @ApiOkData(DeleteAccessCodesResultDto)
  @RequirePermission(PermissionResource.ACCESS_CODES, PermissionAction.DELETE)
  @ResponseMessage('Unused access codes deleted successfully')
  deleteUnused(@Body() dto: DeleteAccessCodesDto) {
    return this.accessCodesService.deleteUnused(dto);
  }
}

@ApiTags('admin/access-codes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard, RoleGuard)
@Controller('admin/partners')
export class AdminAccessCodesController {
  constructor(private readonly accessCodesService: AccessCodesService) {}

  @Get(':partnerId/access-codes')
  @ApiOkPaginated(AccessCodeResponseDto)
  @RequirePermission(PermissionResource.ACCESS_CODES, PermissionAction.READ)
  @ResponseMessage('Partner access codes retrieved successfully')
  findForPartner(
    @Param('partnerId', ParseUUIDPipe) partnerId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.accessCodesService.findForPartner(partnerId, query);
  }

  @Get(':partnerId/access-codes/stats')
  @ApiOkData(AccessCodeStatsResponseDto)
  @RequirePermission(PermissionResource.ACCESS_CODES, PermissionAction.READ)
  @ResponseMessage('Partner access code stats retrieved successfully')
  getStats(@Param('partnerId', ParseUUIDPipe) partnerId: string) {
    return this.accessCodesService.getStatsForPartner(partnerId);
  }

  @Post(':partnerId/access-codes')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedData(GenerateAccessCodesResultDto)
  @RequireRole(RoleName.SUPERADMIN)
  @RequirePermission(PermissionResource.ACCESS_CODES, PermissionAction.CREATE)
  @ResponseMessage('Access codes generated successfully')
  generate(
    @Param('partnerId', ParseUUIDPipe) partnerId: string,
    @Body() dto: GenerateAccessCodesDto,
  ) {
    return this.accessCodesService.generateForPartner(partnerId, dto);
  }

  @Delete(':partnerId/access-codes')
  @ApiOkData(DeleteAccessCodesResultDto)
  @RequirePermission(PermissionResource.ACCESS_CODES, PermissionAction.DELETE)
  @ResponseMessage('Unused access codes deleted successfully')
  deleteUnused(
    @Param('partnerId', ParseUUIDPipe) partnerId: string,
    @Body() dto: DeleteAccessCodesDto,
  ) {
    return this.accessCodesService.deleteForPartner(partnerId, dto);
  }
}
