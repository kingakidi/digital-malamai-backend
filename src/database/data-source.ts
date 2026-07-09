import { join } from 'path';
import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { AccessCode } from '../access-codes/entities/access-code.entity';
import { CourseEnrollment } from '../courses/entities/course-enrollment.entity';
import { CourseVideo } from '../courses/entities/course-video.entity';
import { Course } from '../courses/entities/course.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { Otp } from '../otps/entities/otp.entity';
import { Partner } from '../partners/entities/partner.entity';
import { PaymentTransaction } from '../payments/entities/payment-transaction.entity';
import { PaymentWebhookEvent } from '../payments/entities/payment-webhook-event.entity';
import { Role } from '../roles/entities/role.entity';
import { SystemSetting } from '../settings/entities/system-setting.entity';
import { User } from '../user/entities/user.entity';

config();

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '3306', 10),
  username: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? 'digital_malamai',
  entities: [
    User,
    Role,
    Partner,
    AccessCode,
    Otp,
    Notification,
    SystemSetting,
    Course,
    CourseVideo,
    CourseEnrollment,
    PaymentTransaction,
    PaymentWebhookEvent,
  ],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
});
