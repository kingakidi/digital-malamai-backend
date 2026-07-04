import {
  PermissionGroupDefinition,
} from '../interfaces/permission-catalog.interface';
import {
  PermissionAction,
  PermissionResource,
  PermissionScope,
} from '../types/permission.types';
import { WILDCARD_PERMISSION_KEY } from './permission.constants';

function perm(
  resource: PermissionResource | '*',
  action: PermissionAction | '*',
  scope: PermissionScope,
  title: string,
  description: string,
) {
  const key =
    resource === '*' && action === '*'
      ? WILDCARD_PERMISSION_KEY
      : `${resource}:${action}:${scope}`;

  return { key, title, description, resource, action, scope };
}

export const PERMISSION_GROUPS: PermissionGroupDefinition[] = [
  {
    key: 'users',
    title: 'Users',
    description: 'Manage user accounts, profiles, and assignments',
    permissions: [
      perm(
        PermissionResource.USERS,
        PermissionAction.CREATE,
        PermissionScope.ALL,
        'Create users',
        'Create new user accounts',
      ),
      perm(
        PermissionResource.USERS,
        PermissionAction.READ,
        PermissionScope.ALL,
        'View all users',
        'View every user in the system',
      ),
      perm(
        PermissionResource.USERS,
        PermissionAction.READ,
        PermissionScope.OWN,
        'View own profile',
        'View only the signed-in user profile',
      ),
      perm(
        PermissionResource.USERS,
        PermissionAction.READ,
        PermissionScope.LINKED,
        'View linked users',
        'View users assigned to the signed-in partner',
      ),
      perm(
        PermissionResource.USERS,
        PermissionAction.UPDATE,
        PermissionScope.ALL,
        'Update all users',
        'Update any user account',
      ),
      perm(
        PermissionResource.USERS,
        PermissionAction.UPDATE,
        PermissionScope.OWN,
        'Update own profile',
        'Update only the signed-in user profile',
      ),
      perm(
        PermissionResource.USERS,
        PermissionAction.DELETE,
        PermissionScope.ALL,
        'Delete users',
        'Remove user accounts',
      ),
    ],
  },
  {
    key: 'roles',
    title: 'Roles & permissions',
    description: 'Manage roles and permission assignments',
    permissions: [
      perm(
        PermissionResource.ROLES,
        PermissionAction.CREATE,
        PermissionScope.ALL,
        'Create roles',
        'Create new roles',
      ),
      perm(
        PermissionResource.ROLES,
        PermissionAction.READ,
        PermissionScope.ALL,
        'View roles',
        'View roles and their permissions',
      ),
      perm(
        PermissionResource.ROLES,
        PermissionAction.UPDATE,
        PermissionScope.ALL,
        'Update roles',
        'Modify role names and permissions',
      ),
      perm(
        PermissionResource.ROLES,
        PermissionAction.DELETE,
        PermissionScope.ALL,
        'Delete roles',
        'Remove roles from the system',
      ),
    ],
  },
  {
    key: 'partners',
    title: 'Partners',
    description: 'Manage partner organization profiles',
    permissions: [
      perm(
        PermissionResource.PARTNERS,
        PermissionAction.CREATE,
        PermissionScope.ALL,
        'Create partners',
        'Create partner organization profiles',
      ),
      perm(
        PermissionResource.PARTNERS,
        PermissionAction.READ,
        PermissionScope.ALL,
        'View all partners',
        'View every partner profile',
      ),
      perm(
        PermissionResource.PARTNERS,
        PermissionAction.READ,
        PermissionScope.OWN,
        'View own partner profile',
        'View the signed-in partner organization profile',
      ),
      perm(
        PermissionResource.PARTNERS,
        PermissionAction.UPDATE,
        PermissionScope.ALL,
        'Update all partners',
        'Update any partner profile',
      ),
      perm(
        PermissionResource.PARTNERS,
        PermissionAction.UPDATE,
        PermissionScope.OWN,
        'Update own partner profile',
        'Update the signed-in partner organization profile',
      ),
      perm(
        PermissionResource.PARTNERS,
        PermissionAction.DELETE,
        PermissionScope.ALL,
        'Delete partners',
        'Remove partner profiles',
      ),
    ],
  },
  {
    key: 'access_codes',
    title: 'Access codes',
    description: 'Generate and view partner student access codes',
    permissions: [
      perm(
        PermissionResource.ACCESS_CODES,
        PermissionAction.CREATE,
        PermissionScope.ALL,
        'Generate access codes',
        'Superadmin generates access codes for any partner',
      ),
      perm(
        PermissionResource.ACCESS_CODES,
        PermissionAction.READ,
        PermissionScope.ALL,
        'View all access codes',
        'View access codes for every partner',
      ),
      perm(
        PermissionResource.ACCESS_CODES,
        PermissionAction.READ,
        PermissionScope.LINKED,
        'View partner access codes',
        'Partner views access codes for their organization',
      ),
    ],
  },
  {
    key: 'finance',
    title: 'Finance',
    description: 'Payment and financial records (for future payment storage)',
    permissions: [
      perm(
        PermissionResource.FINANCE,
        PermissionAction.CREATE,
        PermissionScope.ALL,
        'Create finance records',
        'Create payment records for any user',
      ),
      perm(
        PermissionResource.FINANCE,
        PermissionAction.READ,
        PermissionScope.ALL,
        'View all finance records',
        'View every payment record',
      ),
      perm(
        PermissionResource.FINANCE,
        PermissionAction.READ,
        PermissionScope.LINKED,
        'View linked finance records',
        'View payment records for partner-linked users',
      ),
      perm(
        PermissionResource.FINANCE,
        PermissionAction.UPDATE,
        PermissionScope.ALL,
        'Update finance records',
        'Modify payment records',
      ),
      perm(
        PermissionResource.FINANCE,
        PermissionAction.DELETE,
        PermissionScope.ALL,
        'Delete finance records',
        'Remove payment records',
      ),
    ],
  },
  {
    key: 'system',
    title: 'System access',
    description: 'Global access controls',
    permissions: [
      perm(
        '*',
        '*',
        PermissionScope.ALL,
        'Full access',
        'Unrestricted access to every resource and action',
      ),
    ],
  },
];

export const PERMISSION_GROUP_MAP = new Map(
  PERMISSION_GROUPS.map((group) => [group.key, group]),
);

export const PERMISSION_DEFINITION_MAP = new Map(
  PERMISSION_GROUPS.flatMap((group) =>
    group.permissions.map((permission) => [permission.key, permission]),
  ),
);
