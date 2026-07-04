import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { UserService } from '../../../user/user.service';
import { SKIP_MUST_CHANGE_PASSWORD_KEY } from '../decorators/skip-must-change-password.decorator';
import { AuthenticatedUser } from '../../interfaces/authenticated-user.interface';
import { RoleName } from '../../types/permission.types';

interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });

      const user = await this.userService.findByIdWithRole(payload.sub);

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      const authenticatedUser: AuthenticatedUser = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        partnerId: user.partnerId,
        mustChangePassword: user.mustChangePassword,
        role: {
          id: user.role.id,
          name: user.role.name,
          title: user.role.title,
          permissions: user.role.permissions,
        },
      };

      request['user'] = authenticatedUser;

      const skipPasswordChange = this.reflector.getAllAndOverride<boolean>(
        SKIP_MUST_CHANGE_PASSWORD_KEY,
        [context.getHandler(), context.getClass()],
      );

      if (
        !skipPasswordChange &&
        user.mustChangePassword &&
        user.role.name !== RoleName.STUDENT
      ) {
        throw new ForbiddenException(
          'You must change your password before continuing',
        );
      }

      return true;
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
