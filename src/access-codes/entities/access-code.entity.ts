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
@Unique(['code', 'partnerId'])
export class AccessCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  partnerId: string;

  @ManyToOne(() => Partner, { nullable: false })
  @JoinColumn({ name: 'partnerId' })
  partner: Partner;

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
