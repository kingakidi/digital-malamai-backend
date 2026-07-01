import { Global, Module } from '@nestjs/common';
import { AbacService } from './abac.service';

@Global()
@Module({
  providers: [AbacService],
  exports: [AbacService],
})
export class AbacModule {}
