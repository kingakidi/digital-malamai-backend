import { AbacPermission } from './abac-permission.interface';

export interface AuthenticatedUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: {
    id: number;
    name: string;
    title: string;
    permissions: AbacPermission[];
  };
}
