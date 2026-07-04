import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessCode } from '../access-codes/entities/access-code.entity';
import { AuthModule } from '../auth/auth.module';
import { CoursesModule } from '../courses/courses.module';
import { PartnersModule } from '../partners/partners.module';
import { OtpsModule } from '../otps/otps.module';
import { RolesModule } from '../roles/roles.module';
import { SettingsModule } from '../settings/settings.module';
import { User } from '../user/entities/user.entity';
import { UserModule } from '../user/user.module';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AccessCode, User]),
    UserModule,
    forwardRef(() => RolesModule),
    forwardRef(() => PartnersModule),
    SettingsModule,
    OtpsModule,
    forwardRef(() => CoursesModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
