import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/abac/decorators/current-user.decorator';
import { RequireRole } from '../common/abac/decorators/require-role.decorator';
import { JwtAuthGuard } from '../common/abac/guards/jwt-auth.guard';
import { RoleGuard } from '../common/abac/guards/role.guard';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { RoleName } from '../common/types/permission.types';
import {
  ApiCreatedData,
  ApiOkData,
  ApiOkPaginated,
  UserResponseDto,
} from '../common/swagger';
import { AdminPatchUserDto } from './dto/admin-patch-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UserService } from './user.service';

@ApiTags('admin/users')
@ApiBearerAuth()
@RequireRole(RoleName.SUPERADMIN)
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOkPaginated(UserResponseDto)
  @ResponseMessage('Staff accounts retrieved successfully')
  findAllStaff(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.userService.findAllStaff(user, query).then((result) => ({
      data: result.data.map((entry) => this.userService.sanitizeUser(entry)),
      meta: result.meta,
    }));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedData(UserResponseDto)
  @ResponseMessage('Staff account created successfully')
  async createStaff(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const existing = await this.userService.findByEmail(createUserDto.email);

    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const created = await this.userService.createStaffAccount(createUserDto);

    return this.userService.sanitizeUser(created);
  }

  @Patch(':id')
  @ApiOkData(UserResponseDto)
  @ResponseMessage('Staff account updated successfully')
  patchStaff(
    @Param('id') id: string,
    @Body() dto: AdminPatchUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.userService
      .patchStaffAccount(id, dto, user)
      .then((updated) => this.userService.sanitizeUser(updated));
  }
}
