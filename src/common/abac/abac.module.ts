import { Global, Module } from '@nestjs/common';
import { AbacService } from './abac.service';
import { RoleGuard } from './guards/role.guard';

@Global()
@Module({
  providers: [AbacService, RoleGuard],
  exports: [AbacService, RoleGuard],
})
export class AbacModule {}
