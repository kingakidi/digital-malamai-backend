import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/abac/decorators/current-user.decorator';
import { RequirePermission } from '../common/abac/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../common/abac/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/abac/guards/permission.guard';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import {
  PermissionAction,
  PermissionResource,
} from '../common/types/permission.types';
import {
  ApiCreatedData,
  ApiOkData,
  ApiOkNull,
  ApiOkPaginated,
  PermissionGroupDefinitionDto,
  RoleResponseDto,
} from '../common/swagger';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

@ApiTags('roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('permissions/groups')
  @ApiOkData(PermissionGroupDefinitionDto, { isArray: true })
  @RequirePermission(PermissionResource.ROLES, PermissionAction.READ)
  @ResponseMessage('Permission groups retrieved successfully')
  getPermissionGroups() {
    return this.rolesService.getPermissionGroups();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedData(RoleResponseDto)
  @RequirePermission(PermissionResource.ROLES, PermissionAction.CREATE)
  @ResponseMessage('Role created successfully')
  async create(@Body() createRoleDto: CreateRoleDto) {
    const existing = await this.rolesService.findByTitle(createRoleDto.title);
    if (existing) {
      throw new ConflictException('Role title already exists');
    }

    const existingName = await this.rolesService.findByName(createRoleDto.name);
    if (existingName) {
      throw new ConflictException('Role name already exists');
    }

    return this.rolesService.create(createRoleDto);
  }

  @Get()
  @ApiOkPaginated(RoleResponseDto)
  @RequirePermission(PermissionResource.ROLES, PermissionAction.READ)
  @ResponseMessage('Roles retrieved successfully')
  findAll(
    @Query() query: PaginationQueryDto,
    @CurrentUser() _user: AuthenticatedUser,
  ) {
    return this.rolesService.findAll(query);
  }

  @Get(':id')
  @ApiOkData(RoleResponseDto)
  @RequirePermission(PermissionResource.ROLES, PermissionAction.READ)
  @ResponseMessage('Role retrieved successfully')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.findOne(id);
  }

  @Put(':id')
  @ApiOkData(RoleResponseDto)
  @RequirePermission(PermissionResource.ROLES, PermissionAction.UPDATE)
  @ResponseMessage('Role updated successfully')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.rolesService.update(id, updateRoleDto);
  }

  @Delete(':id')
  @ApiOkNull()
  @RequirePermission(PermissionResource.ROLES, PermissionAction.DELETE)
  @ResponseMessage('Role deleted successfully')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.rolesService.remove(id);
    return null;
  }
}
