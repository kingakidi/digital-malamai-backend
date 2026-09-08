import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Course } from './course.entity';
import { CourseResourceType } from '../enums/course-resource-type.enum';

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

  /** Resource URL (video, document, or image). Column name kept for compatibility. */
  @Column()
  vimeoUrl: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: CourseResourceType.VIDEO,
  })
  resourceType: CourseResourceType;

  @Column({ default: 0 })
  position: number;

  @Column({ type: 'int', nullable: true })
  duration: number | null;

  @Column({ type: 'text', nullable: true })
  details: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
