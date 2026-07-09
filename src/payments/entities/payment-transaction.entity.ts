import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import {
  PaidFor,
  PaymentPlatform,
  PaymentStatus,
} from '../../common/types/payment.types';
import { Course } from '../../courses/entities/course.entity';
import { Partner } from '../../partners/entities/partner.entity';
import { User } from '../../user/entities/user.entity';

@Entity('payment_transactions')
@Unique(['paymentPlatform', 'externalTransactionId'])
export class PaymentTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: PaymentPlatform })
  paymentPlatform: PaymentPlatform;

  @Column()
  externalTransactionId: string;

  @Column({ type: 'varchar', nullable: true })
  txRef: string | null;

  @Column({ type: 'varchar', nullable: true })
  flwRef: string | null;

  @Column({ type: 'enum', enum: PaidFor })
  paidFor: PaidFor;

  @Column({ type: 'varchar', length: 36, nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  partnerId: string | null;

  @ManyToOne(() => Partner, { nullable: true })
  @JoinColumn({ name: 'partnerId' })
  partner: Partner | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  courseId: string | null;

  @ManyToOne(() => Course, { nullable: true })
  @JoinColumn({ name: 'courseId' })
  course: Course | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  fees: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  partnerCut: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  platformCut: number;

  @Column({ default: 'NGN' })
  currency: string;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ default: false })
  webhookVerified: boolean;

  @Column({ default: false })
  apiVerified: boolean;

  @Column({ default: false })
  fulfillmentCompleted: boolean;

  @Column({ type: 'datetime', nullable: true })
  verifiedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
