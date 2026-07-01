import { BadRequestException } from '@nestjs/common';
import { AbacPermission } from '../interfaces/abac-permission.interface';
import {
  PermissionGroupDefinition,
  PermissionGroupState,
  RolePermissionView,
} from '../interfaces/permission-catalog.interface';
import {
  PERMISSION_DEFINITION_MAP,
  PERMISSION_GROUPS,
} from '../constants/permission-catalog.constants';
import { WILDCARD_PERMISSION_KEY } from '../constants/permission.constants';
import {
  PermissionAction,
  PermissionResource,
  PermissionScope,
} from '../types/permission.types';

export function resolvePermissionKeys(keys: string[]): AbacPermission[] {
  if (!keys.length) {
    throw new BadRequestException('At least one permission key is required');
  }

  const uniqueKeys = [...new Set(keys)];

  for (const key of uniqueKeys) {
    if (!PERMISSION_DEFINITION_MAP.has(key)) {
      throw new BadRequestException(`Unknown permission key: ${key}`);
    }
  }

  if (uniqueKeys.includes(WILDCARD_PERMISSION_KEY)) {
    return [{ resource: '*', actions: ['*'], scope: PermissionScope.ALL }];
  }

  const grouped = new Map<string, AbacPermission>();

  for (const key of uniqueKeys) {
    const definition = PERMISSION_DEFINITION_MAP.get(key)!;
    const groupKey = `${definition.resource}:${definition.scope}`;

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        resource: definition.resource as PermissionResource,
        actions: [],
        scope: definition.scope,
      });
    }

    const permission = grouped.get(groupKey)!;
    const action = definition.action as PermissionAction;

    if (!permission.actions.includes(action)) {
      permission.actions.push(action);
    }
  }

  return Array.from(grouped.values());
}

export function permissionsToKeys(permissions: AbacPermission[]): string[] {
  if (!permissions.length) {
    return [];
  }

  const hasWildcard = permissions.some(
    (permission) =>
      permission.resource === '*' && permission.actions.includes('*'),
  );

  if (hasWildcard) {
    return [WILDCARD_PERMISSION_KEY];
  }

  const keys: string[] = [];

  for (const permission of permissions) {
    const scope = permission.scope ?? PermissionScope.ALL;

    for (const action of permission.actions) {
      const key = `${permission.resource}:${action}:${scope}`;
      if (PERMISSION_DEFINITION_MAP.has(key)) {
        keys.push(key);
      }
    }
  }

  return [...new Set(keys)];
}

export function buildPermissionGroups(
  permissions: AbacPermission[],
): PermissionGroupState[] {
  const grantedKeys = new Set(permissionsToKeys(permissions));

  return PERMISSION_GROUPS.map((group) => ({
    key: group.key,
    title: group.title,
    description: group.description,
    permissions: group.permissions.map((permission) => ({
      key: permission.key,
      title: permission.title,
      description: permission.description,
      granted: grantedKeys.has(permission.key),
    })),
  }));
}

export function buildRolePermissionView(
  permissions: AbacPermission[],
): RolePermissionView {
  return {
    permissionKeys: permissionsToKeys(permissions),
    permissionGroups: buildPermissionGroups(permissions),
  };
}

export function getPermissionCatalog(): PermissionGroupDefinition[] {
  return PERMISSION_GROUPS;
}
