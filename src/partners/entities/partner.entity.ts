import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { CommissionType } from '../../common/types/payment.types';
import { PartnerStatus } from '../../common/types/partner-status.type';
import { User } from '../../user/entities/user.entity';

@Entity('partners')
@Unique(['email'])
export class Partner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  email: string;

  @Column({ type: 'varchar', nullable: true })
  phoneNumber: string | null;

  @Column({ type: 'varchar', nullable: true })
  address: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', nullable: true })
  logoUrl: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  onboardingFee: number | null;

  @Column({ type: 'enum', enum: CommissionType, nullable: true })
  commissionType: CommissionType | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  commissionValue: number | null;

  /** @deprecated use commissionType + commissionValue */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  onboardPercentage: number;

  @Column({ type: 'enum', enum: PartnerStatus, default: PartnerStatus.ACTIVE })
  status: PartnerStatus;

  @OneToMany(() => User, (user) => user.partner)
  users: User[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
