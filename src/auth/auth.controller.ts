import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/abac/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/abac/guards/jwt-auth.guard';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { buildRolePermissionView } from '../common/utils/permission.util';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';
import { SignInDto } from './dto/sign-in.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  @Post('login')
  @ResponseMessage('Login successful')
  login(@Body() signInDto: SignInDto) {
    return this.authService.login(signInDto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ResponseMessage('Profile retrieved successfully')
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.userService.findByIdWithRole(user.id);

    if (!profile) {
      return user;
    }

    const sanitized = this.userService.sanitizeUser(profile);
    const rolePermissions = buildRolePermissionView(profile.role.permissions);

    return {
      ...sanitized,
      role: {
        ...sanitized.role,
        permissionKeys: rolePermissions.permissionKeys,
        permissionGroups: rolePermissions.permissionGroups,
      },
    };
  }
}
