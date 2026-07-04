import { RoleName } from '../types/permission.types';

export const STAFF_COURSE_ROLES = [
  RoleName.SUPERADMIN,
  RoleName.ADMIN,
  RoleName.MANAGER,
] as const;

export const STAFF_ACCOUNT_ROLES = [
  RoleName.SUPERADMIN,
  RoleName.ADMIN,
  RoleName.MANAGER,
  RoleName.PARTNER,
] as const;
