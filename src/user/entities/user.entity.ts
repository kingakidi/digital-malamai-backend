import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { OnboardingStatus } from '../../common/types/onboarding-status.type';
import { AccountStatus } from '../../common/types/account-status.type';
import { AccessCode } from '../../access-codes/entities/access-code.entity';
import { Partner } from '../../partners/entities/partner.entity';
import { Role } from '../../roles/entities/role.entity';

@Entity('users')
@Unique(['email'])
@Unique(['phone'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  email: string;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'datetime', nullable: true })
  emailVerifiedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  phoneVerifiedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  phoneVerificationSkippedAt: Date | null;

  @Column({
    type: 'enum',
    enum: OnboardingStatus,
    nullable: true,
  })
  onboardingStatus: OnboardingStatus | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({
    type: 'enum',
    enum: AccountStatus,
    default: AccountStatus.ACTIVE,
  })
  accountStatus: AccountStatus;

  @Column({ default: false })
  mustChangePassword: boolean;

  @Column({ type: 'varchar', nullable: true })
  password: string | null;

  @ManyToOne(() => Role, (role) => role.users, { nullable: false, eager: true })
  role: Role;

  @Column({ type: 'varchar', length: 36, nullable: true })
  partnerId: string | null;

  @ManyToOne(() => Partner, (partner) => partner.users, { nullable: true })
  @JoinColumn({ name: 'partnerId' })
  partner: Partner | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  accessCodeId: string | null;

  @ManyToOne(() => AccessCode, { nullable: true })
  @JoinColumn({ name: 'accessCodeId' })
  accessCode: AccessCode | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  async hashPassword(): Promise<void> {
    if (this.password) {
      this.password = await bcrypt.hash(this.password, 10);
    }
  }
}
