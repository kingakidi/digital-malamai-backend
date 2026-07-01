import { DefaultRoleDefinition } from '../interfaces/default-role-definition.interface';
import {
  PermissionAction,
  PermissionResource,
  PermissionScope,
  RoleName,
} from '../types/permission.types';

export const DEFAULT_ROLES: DefaultRoleDefinition[] = [
  {
    name: RoleName.SUPERADMIN,
    title: 'Super Admin',
    permissions: [
      { resource: '*', actions: ['*'], scope: PermissionScope.ALL },
    ],
  },
  {
    name: RoleName.ADMIN,
    title: 'Admin',
    permissions: [
      { resource: '*', actions: ['*'], scope: PermissionScope.ALL },
    ],
  },
  {
    name: RoleName.MANAGER,
    title: 'Manager',
    permissions: [
      {
        resource: PermissionResource.USERS,
        actions: [
          PermissionAction.CREATE,
          PermissionAction.READ,
          PermissionAction.UPDATE,
        ],
        scope: PermissionScope.ALL,
      },
      {
        resource: PermissionResource.ROLES,
        actions: [
          PermissionAction.CREATE,
          PermissionAction.READ,
          PermissionAction.UPDATE,
        ],
        scope: PermissionScope.ALL,
      },
    ],
  },
  {
    name: RoleName.PARTNER,
    title: 'Partner',
    permissions: [
      {
        resource: PermissionResource.USERS,
        actions: [PermissionAction.READ],
        scope: PermissionScope.LINKED,
      },
      {
        resource: PermissionResource.FINANCE,
        actions: [PermissionAction.READ],
        scope: PermissionScope.LINKED,
      },
    ],
  },
  {
    name: RoleName.USER,
    title: 'User',
    permissions: [
      {
        resource: PermissionResource.USERS,
        actions: [PermissionAction.READ, PermissionAction.UPDATE],
        scope: PermissionScope.OWN,
      },
    ],
  },
];
