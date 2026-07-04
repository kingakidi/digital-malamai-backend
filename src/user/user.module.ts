import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { RolesModule } from '../roles/roles.module';
import { User } from './entities/user.entity';
import { AdminUsersController } from './admin-users.controller';
import { UserController } from './user.controller';
import { SuperadminSeedService } from './superadmin-seed.service';
import { UserSeedService } from './user-seed.service';
import { UserService } from './user.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    forwardRef(() => RolesModule),
    forwardRef(() => AuthModule),
    MailModule,
  ],
  controllers: [UserController, AdminUsersController],
  providers: [UserService, UserSeedService, SuperadminSeedService],
  exports: [UserService, SuperadminSeedService],
})
export class UserModule {}
