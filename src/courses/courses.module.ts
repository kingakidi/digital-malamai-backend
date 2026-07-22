import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PaymentTransaction } from '../payments/entities/payment-transaction.entity';
import {
  AdminCoursesController,
  StaffCoursesController,
} from './admin-courses.controller';
import { CourseVideosController } from './course-videos.controller';
import { CoursesController } from './courses.controller';
import { CourseEnrollment } from './entities/course-enrollment.entity';
import { CourseVideo } from './entities/course-video.entity';
import { Course } from './entities/course.entity';
import { CoursesService } from './courses.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Course,
      CourseEnrollment,
      CourseVideo,
      PaymentTransaction,
    ]),
    forwardRef(() => AuthModule),
  ],
  controllers: [
    CoursesController,
    AdminCoursesController,
    StaffCoursesController,
    CourseVideosController,
  ],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
