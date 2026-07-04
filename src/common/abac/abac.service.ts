import { Injectable } from '@nestjs/common';
import { AbacPermission } from '../interfaces/abac-permission.interface';
import {
  PermissionAction,
  PermissionResource,
  PermissionScope,
} from '../types/permission.types';

export interface AbacSubject {
  id: string;
  partnerId?: string | null;
  role: {
    name: string;
    permissions: AbacPermission[];
  };
}

@Injectable()
export class AbacService {
  can(
    subject: AbacSubject,
    resource: PermissionResource,
    action: PermissionAction,
  ): boolean {
    const scope = this.resolveScope(subject, resource, action);

    if (!scope) {
      return false;
    }

    return this.satisfiesScopeContext(subject, scope, resource);
  }

  resolveScope(
    subject: AbacSubject,
    resource: PermissionResource,
    action: PermissionAction,
  ): PermissionScope | null {
    const permissions = subject.role.permissions ?? [];

    for (const permission of permissions) {
      if (!this.matchesResource(permission, resource)) {
        continue;
      }

      if (!this.matchesAction(permission, action)) {
        continue;
      }

      return permission.scope ?? PermissionScope.ALL;
    }

    return null;
  }

  satisfiesScopeContext(
    subject: AbacSubject,
    scope: PermissionScope,
    resource: PermissionResource,
  ): boolean {
    switch (scope) {
      case PermissionScope.LINKED:
        return Boolean(subject.partnerId);
      case PermissionScope.OWN:
        if (resource === PermissionResource.PARTNERS) {
          return Boolean(subject.partnerId);
        }
        return true;
      default:
        return true;
    }
  }

  private matchesResource(
    permission: AbacPermission,
    resource: PermissionResource,
  ): boolean {
    return permission.resource === '*' || permission.resource === resource;
  }

  private matchesAction(
    permission: AbacPermission,
    action: PermissionAction,
  ): boolean {
    return (
      permission.actions.includes('*') || permission.actions.includes(action)
    );
  }
}
