import {
  PermissionAction,
  PermissionResource,
  PermissionScope,
} from '../types/permission.types';

export interface PermissionDefinition {
  key: string;
  title: string;
  description: string;
  resource: PermissionResource | '*';
  action: PermissionAction | '*';
  scope: PermissionScope;
}

export interface PermissionGroupDefinition {
  key: string;
  title: string;
  description: string;
  permissions: PermissionDefinition[];
}

export interface PermissionCatalogItem extends PermissionDefinition {
  groupKey: string;
  groupTitle: string;
}

export interface PermissionGroupState {
  key: string;
  title: string;
  description: string;
  permissions: {
    key: string;
    title: string;
    description: string;
    granted: boolean;
  }[];
}

export interface RolePermissionView {
  permissionKeys: string[];
  permissionGroups: PermissionGroupState[];
}
