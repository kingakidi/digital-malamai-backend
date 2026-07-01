export enum PermissionAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
}

export enum PermissionResource {
  USERS = 'users',
  ROLES = 'roles',
  FINANCE = 'finance',
}

export enum PermissionScope {
  ALL = 'all',
  OWN = 'own',
  LINKED = 'linked',
}

export enum RoleName {
  SUPERADMIN = 'superadmin',
  ADMIN = 'admin',
  MANAGER = 'manager',
  PARTNER = 'partner',
  USER = 'user',
}
