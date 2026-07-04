import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { RolesModule } from '../roles/roles.module';
import { User } from './entities/user.entity';
import { AdminUsersController } from './admin-users.controller';
import { UserController } from './user.controller';
import { UserSeedService } from './user-seed.service';
import { UserService } from './user.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    forwardRef(() => RolesModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [UserController, AdminUsersController],
  providers: [UserService, UserSeedService],
  exports: [UserService],
})
export class UserModule {}
