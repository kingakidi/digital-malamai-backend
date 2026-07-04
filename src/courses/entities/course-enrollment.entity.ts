import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { PaymentStatus } from '../../common/types/payment.types';
import { PaymentTransaction } from '../../payments/entities/payment-transaction.entity';
import { User } from '../../user/entities/user.entity';
import { Course } from './course.entity';

@Entity('course_enrollments')
@Unique(['userId', 'courseId'])
export class CourseEnrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  courseId: string;

  @ManyToOne(() => Course, (course) => course.enrollments, { nullable: false })
  @JoinColumn({ name: 'courseId' })
  course: Course;

  @Column()
  paymentTransactionId: string;

  @ManyToOne(() => PaymentTransaction, { nullable: false })
  @JoinColumn({ name: 'paymentTransactionId' })
  paymentTransaction: PaymentTransaction;

  @Column({ type: 'datetime' })
  enrolledAt: Date;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.SUCCESS })
  paymentStatus: PaymentStatus;

  @Column({ type: 'datetime', nullable: true })
  unlockedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
