import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoleName } from '../common/types/permission.types';
import { RolesService } from '../roles/roles.service';
import { UserService } from './user.service';

export type SuperadminSeedResult = 'created' | 'skipped' | 'failed';

@Injectable()
export class SuperadminSeedService {
  private readonly logger = new Logger(SuperadminSeedService.name);

  constructor(
    private readonly userService: UserService,
    private readonly rolesService: RolesService,
    private readonly configService: ConfigService,
  ) {}

  async seedIfMissing(): Promise<SuperadminSeedResult> {
    const email = this.configService.get<string>('superadmin.email');
    const password = this.configService.get<string>('superadmin.password');

    if (!email || !password) {
      this.logger.warn(
        'SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set — skipping superadmin seed',
      );
      return 'failed';
    }

    const existing = await this.userService.findByEmail(email.toLowerCase());

    if (existing) {
      this.logger.log(`Superadmin already exists for ${email} — skipped`);
      return 'skipped';
    }

    const superadminRole = await this.rolesService.findByName(RoleName.SUPERADMIN);

    if (!superadminRole) {
      this.logger.error('Superadmin role not found — cannot seed superadmin user');
      return 'failed';
    }

    await this.userService.createSuperadminSeedUser({
      firstName: this.configService.get<string>('superadmin.firstName') ?? 'Super',
      lastName: this.configService.get<string>('superadmin.lastName') ?? 'Admin',
      email: email.toLowerCase(),
      password,
      roleId: superadminRole.id,
    });

    this.logger.log(`Superadmin user created: ${email}`);
    return 'created';
  }
}
