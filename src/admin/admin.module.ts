import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoursesModule } from '../courses/courses.module';
import { StudentsModule } from '../students/students.module';
import { AdminReportsController } from './admin-reports.controller';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => CoursesModule),
    forwardRef(() => StudentsModule),
  ],
  controllers: [AdminReportsController],
})
export class AdminModule {}
