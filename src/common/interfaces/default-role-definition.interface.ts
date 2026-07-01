import { RoleName } from '../types/permission.types';
import { AbacPermission } from './abac-permission.interface';

export interface DefaultRoleDefinition {
  name: RoleName;
  title: string;
  permissions: AbacPermission[];
}
