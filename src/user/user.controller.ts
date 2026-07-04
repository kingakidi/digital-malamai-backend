import {
  Body,
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
  UserResponseDto,
} from '../common/swagger';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserService } from './user.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedData(UserResponseDto)
  @RequirePermission(PermissionResource.USERS, PermissionAction.CREATE)
  @ResponseMessage('User created successfully')
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.userService.create(createUserDto);
    return this.userService.sanitizeUser(user);
  }

  @Get()
  @ApiOkPaginated(UserResponseDto)
  @RequirePermission(PermissionResource.USERS, PermissionAction.READ)
  @ResponseMessage('Users retrieved successfully')
  async findAll(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.userService.findAll(user, query);
    return {
      data: result.data.map((entry) => this.userService.sanitizeUser(entry)),
      meta: result.meta,
    };
  }

  @Get(':id')
  @ApiOkData(UserResponseDto)
  @RequirePermission(PermissionResource.USERS, PermissionAction.READ)
  @ResponseMessage('User retrieved successfully')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const found = await this.userService.findOne(id, user);
    return this.userService.sanitizeUser(found);
  }

  @Put(':id')
  @ApiOkData(UserResponseDto)
  @RequirePermission(PermissionResource.USERS, PermissionAction.UPDATE)
  @ResponseMessage('User updated successfully')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const updated = await this.userService.update(id, updateUserDto, user);
    return this.userService.sanitizeUser(updated);
  }

  @Delete(':id')
  @ApiOkNull()
  @RequirePermission(PermissionResource.USERS, PermissionAction.DELETE)
  @ResponseMessage('User deleted successfully')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.userService.remove(id, user);
    return null;
  }
}
