import { SetMetadata } from '@nestjs/common';
import {
  PermissionAction,
  PermissionResource,
} from '../../types/permission.types';

export const PERMISSION_KEY = 'permission';

export interface RequiredPermission {
  resource: PermissionResource;
  action: PermissionAction;
}

export const RequirePermission = (
  resource: PermissionResource,
  action: PermissionAction,
) => SetMetadata(PERMISSION_KEY, { resource, action } as RequiredPermission);
