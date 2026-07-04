import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AbacService } from '../abac.service';
import {
  PERMISSION_KEY,
  RequiredPermission,
} from '../decorators/require-permission.decorator';
import { AuthenticatedUser } from '../../interfaces/authenticated-user.interface';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abacService: AbacService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RequiredPermission>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const scope = this.abacService.resolveScope(
      user,
      required.resource,
      required.action,
    );

    if (!scope) {
      throw new ForbiddenException(
        `Insufficient permissions for ${required.action} on ${required.resource}`,
      );
    }

    if (
      !this.abacService.satisfiesScopeContext(user, scope, required.resource)
    ) {
      throw new ForbiddenException(
        'Partner profile is not linked to this account',
      );
    }

    return true;
  }
}
