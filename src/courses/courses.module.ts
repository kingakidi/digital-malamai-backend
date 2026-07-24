import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PaymentTransaction } from '../payments/entities/payment-transaction.entity';
import { AdminCourseCategoriesController } from './admin-course-categories.controller';
import {
  AdminCoursesController,
  StaffCoursesController,
} from './admin-courses.controller';
import { CourseCategoriesController } from './course-categories.controller';
import { CourseCategoriesSeedService } from './course-categories-seed.service';
import { CourseCategoriesService } from './course-categories.service';
import { CourseVideosController } from './course-videos.controller';
import { CoursesController } from './courses.controller';
import { CourseCategory } from './entities/course-category.entity';
import { CourseEnrollment } from './entities/course-enrollment.entity';
import { CourseVideo } from './entities/course-video.entity';
import { Course } from './entities/course.entity';
import { CoursesService } from './courses.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Course,
      CourseCategory,
      CourseEnrollment,
      CourseVideo,
      PaymentTransaction,
    ]),
    forwardRef(() => AuthModule),
  ],
  controllers: [
    CoursesController,
    CourseCategoriesController,
    AdminCoursesController,
    StaffCoursesController,
    CourseVideosController,
    AdminCourseCategoriesController,
  ],
  providers: [
    CoursesService,
    CourseCategoriesService,
    CourseCategoriesSeedService,
  ],
  exports: [CoursesService, CourseCategoriesService],
})
export class CoursesModule {}
