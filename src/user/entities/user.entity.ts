import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Role } from '../../roles/entities/role.entity';

@Entity('users')
@Unique(['email'])
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  email: string;

  @Column({ default: true })
  isActive: boolean;

  @Column()
  password: string;

  @ManyToOne(() => Role, (role) => role.users, { nullable: false, eager: true })
  role: Role;

  @Column({ nullable: true })
  partnerId: number | null;

  @ManyToOne(() => User, (user) => user.linkedUsers, { nullable: true })
  @JoinColumn({ name: 'partnerId' })
  partner: User | null;

  @OneToMany(() => User, (user) => user.partner)
  linkedUsers: User[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  async hashPassword(): Promise<void> {
    this.password = await bcrypt.hash(this.password, 10);
  }
}
