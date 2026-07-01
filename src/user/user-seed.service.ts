import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoleName } from '../common/types/permission.types';
import { RolesService } from '../roles/roles.service';
import { UserService } from './user.service';

@Injectable()
export class UserSeedService implements OnModuleInit {
  private readonly logger = new Logger(UserSeedService.name);

  constructor(
    private readonly userService: UserService,
    private readonly rolesService: RolesService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = this.configService.get<string>('SUPERADMIN_EMAIL');
    const password = this.configService.get<string>('SUPERADMIN_PASSWORD');

    if (!email || !password) {
      this.logger.warn(
        'SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD not set — skipping superadmin seed',
      );
      return;
    }

    const existing = await this.userService.findByEmail(email);
    if (existing) {
      return;
    }

    const superadminRole = await this.rolesService.findByName(
      RoleName.SUPERADMIN,
    );

    if (!superadminRole) {
      this.logger.error(
        'Superadmin role not found — cannot seed superadmin user',
      );
      return;
    }

    await this.userService.create({
      firstName:
        this.configService.get<string>('SUPERADMIN_FIRST_NAME') ?? 'Super',
      lastName:
        this.configService.get<string>('SUPERADMIN_LAST_NAME') ?? 'Admin',
      email,
      password,
      roleId: superadminRole.id,
    });

    this.logger.log(`Seeded superadmin user: ${email}`);
  }
}
