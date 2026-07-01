import { Injectable } from '@nestjs/common';
import { AbacPermission } from '../interfaces/abac-permission.interface';
import {
  PermissionAction,
  PermissionResource,
  PermissionScope,
} from '../types/permission.types';

export interface AbacSubject {
  id: number;
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
    return this.resolveScope(subject, resource, action) !== null;
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
