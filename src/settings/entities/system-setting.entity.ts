import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('system_settings')
export class SystemSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  key: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ default: 'NGN' })
  currency: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export const SYSTEM_SETTING_KEYS = {
  ONBOARDING_FEE: 'Onboarding Fee',
  COURSE_LESSON_WATCH_IN_APP: 'Course Lesson Watch In App',
  COURSE_WHATSAPP_DELIVERY: 'Course WhatsApp Delivery',
} as const;
