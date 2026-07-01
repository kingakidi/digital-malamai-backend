import {
  PermissionAction,
  PermissionResource,
  PermissionScope,
} from '../types/permission.types';

export interface AbacPermission {
  resource: PermissionResource | '*';
  actions: (PermissionAction | '*')[];
  scope?: PermissionScope;
}
