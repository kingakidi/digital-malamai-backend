import { RolePermissionView } from '../../common/interfaces/permission-catalog.interface';
import { Role } from '../entities/role.entity';

export type SerializedRole = Omit<Role, 'users'> & RolePermissionView;
