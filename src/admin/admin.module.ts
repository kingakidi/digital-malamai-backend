import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CoursesModule } from '../courses/courses.module';
import { Partner } from '../partners/entities/partner.entity';
import { PaymentsModule } from '../payments/payments.module';
import { PaymentTransaction } from '../payments/entities/payment-transaction.entity';
import { StudentsModule } from '../students/students.module';
import { User } from '../user/entities/user.entity';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminPaymentsController } from './admin-payments.controller';
import { AdminReportsController } from './admin-reports.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentTransaction, User, Partner]),
    forwardRef(() => AuthModule),
    forwardRef(() => CoursesModule),
    forwardRef(() => StudentsModule),
    PaymentsModule,
  ],
  controllers: [
    AdminReportsController,
    AdminPaymentsController,
    AdminDashboardController,
  ],
  providers: [AdminDashboardService],
})
export class AdminModule {}
