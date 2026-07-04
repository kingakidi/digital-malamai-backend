import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  CommissionType,
  CourseStatus,
} from '../../common/types/payment.types';
import { Partner } from '../../partners/entities/partner.entity';
import { CourseEnrollment } from './course-enrollment.entity';
import { CourseVideo } from './course-video.entity';

@Entity('courses')
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  partnerId: string;

  @ManyToOne(() => Partner, { nullable: false })
  @JoinColumn({ name: 'partnerId' })
  partner: Partner;

  @Column({ unique: true })
  slug: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', nullable: true })
  thumbnailUrl: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  price: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  discount: number;

  @Column({ default: false })
  isFree: boolean;

  @Column({ type: 'enum', enum: CourseStatus, default: CourseStatus.DRAFT })
  status: CourseStatus;

  @Column({ type: 'enum', enum: CommissionType, nullable: true })
  partnerCommissionType: CommissionType | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  partnerCommissionValue: number | null;

  @OneToMany(() => CourseVideo, (video) => video.course)
  videos: CourseVideo[];

  @OneToMany(() => CourseEnrollment, (enrollment) => enrollment.course)
  enrollments: CourseEnrollment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
