import { Injectable, OnModuleInit } from '@nestjs/common';
import { SuperadminSeedService } from './superadmin-seed.service';

@Injectable()
export class UserSeedService implements OnModuleInit {
  constructor(private readonly superadminSeedService: SuperadminSeedService) {}

  async onModuleInit(): Promise<void> {
    await this.superadminSeedService.seedIfMissing();
  }
}
