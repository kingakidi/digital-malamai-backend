import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CoursesModule } from '../courses/courses.module';
import { RolesModule } from '../roles/roles.module';
import { StudentsModule } from '../students/students.module';
import { UserModule } from '../user/user.module';
import { Partner } from './entities/partner.entity';
import {
  AdminPartnersController,
  PartnerPortalController,
  PartnersController,
} from './partners.controller';
import { PartnersService } from './partners.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Partner]),
    forwardRef(() => AuthModule),
    forwardRef(() => CoursesModule),
    forwardRef(() => StudentsModule),
    RolesModule,
    UserModule,
  ],
  controllers: [PartnerPortalController, PartnersController, AdminPartnersController],
  providers: [PartnersService],
  exports: [PartnersService],
})
export class PartnersModule {}
