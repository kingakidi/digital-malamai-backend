import { SetMetadata } from '@nestjs/common';
import { RoleName } from '../../types/permission.types';

export const ROLES_KEY = 'roles';

export const RequireRole = (...roles: RoleName[]) =>
  SetMetadata(ROLES_KEY, roles);
