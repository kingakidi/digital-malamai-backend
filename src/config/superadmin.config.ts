import { registerAs } from '@nestjs/config';

export default registerAs('superadmin', () => ({
  email: (
    process.env.SUPER_ADMIN_EMAIL ??
    process.env.SUPERADMIN_EMAIL ??
    ''
  ).trim(),
  password:
    process.env.SUPER_ADMIN_PASSWORD ?? process.env.SUPERADMIN_PASSWORD ?? '',
  firstName:
    process.env.SUPER_ADMIN_FIRST_NAME ??
    process.env.SUPERADMIN_FIRST_NAME ??
    'Super',
  lastName:
    process.env.SUPER_ADMIN_LAST_NAME ??
    process.env.SUPERADMIN_LAST_NAME ??
    'Admin',
}));
