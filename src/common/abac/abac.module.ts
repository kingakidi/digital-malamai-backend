import { Global, Module } from '@nestjs/common';
import { AbacService } from './abac.service';
import { MustChangePasswordGuard } from './guards/must-change-password.guard';
import { RoleGuard } from './guards/role.guard';

@Global()
@Module({
  providers: [AbacService, RoleGuard, MustChangePasswordGuard],
  exports: [AbacService, RoleGuard, MustChangePasswordGuard],
})
export class AbacModule {}
