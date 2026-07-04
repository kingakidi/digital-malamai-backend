import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoursesModule } from '../courses/courses.module';
import { PaymentsModule } from '../payments/payments.module';
import { StudentsModule } from '../students/students.module';
import { AdminPaymentsController } from './admin-payments.controller';
import { AdminReportsController } from './admin-reports.controller';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => CoursesModule),
    forwardRef(() => StudentsModule),
    PaymentsModule,
  ],
  controllers: [AdminReportsController, AdminPaymentsController],
})
export class AdminModule {}
