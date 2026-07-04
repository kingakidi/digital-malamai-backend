export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  partnerId: string | null;
  mustChangePassword: boolean;
  role: {
    id: string;
    name: string;
    title: string;
    permissions: import('./abac-permission.interface').AbacPermission[];
  };
}
