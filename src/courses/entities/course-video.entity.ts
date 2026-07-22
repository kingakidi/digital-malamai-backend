import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Course } from './course.entity';

@Entity('course_videos')
export class CourseVideo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  courseId: string;

  @ManyToOne(() => Course, (course) => course.videos, { nullable: false })
  @JoinColumn({ name: 'courseId' })
  course: Course;

  @Column()
  title: string;

  @Column()
  vimeoUrl: string;

  @Column({ default: 0 })
  position: number;

  @Column({ type: 'int', nullable: true })
  duration: number | null;

  @Column({ type: 'text', nullable: true })
  details: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
