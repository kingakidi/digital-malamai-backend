import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Partner } from '../../partners/entities/partner.entity';
import { User } from '../../user/entities/user.entity';

@Entity('access_codes')
@Unique('IDX_access_codes_code', ['code'])
export class AccessCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  partnerId: string | null;

  @ManyToOne(() => Partner, { nullable: true })
  @JoinColumn({ name: 'partnerId' })
  partner: Partner | null;

  @Column({ length: 6 })
  code: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  studentId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'studentId' })
  student: User | null;

  @Column({ default: false })
  isUsed: boolean;

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
