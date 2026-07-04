import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/interfaces/pagination.interface';
import { OnboardingStatus } from '../common/types/onboarding-status.type';
import { CourseStatus, PaidFor, PaymentStatus } from '../common/types/payment.types';
import { RoleName } from '../common/types/permission.types';
import { SortOrder } from '../common/types/sort-order.type';
import {
  buildPaginatedResult,
  getPaginationSkip,
} from '../common/utils/pagination.util';
import { generateUniqueSlug, slugify } from '../common/utils/slug.util';
import { PartnersService } from '../partners/partners.service';
import { PaymentTransaction } from '../payments/entities/payment-transaction.entity';
import { resolveCoursePrice } from '../payments/utils/payment.util';
import { UserService } from '../user/user.service';
import { CreateCourseVideoDto } from './dto/create-course-video.dto';
import { CreateCourseDto } from './dto/create-course.dto';
import { PublishCourseDto } from './dto/publish-course.dto';
import { UpdateCourseVideoDto } from './dto/update-course-video.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CourseEnrollment } from './entities/course-enrollment.entity';
import { CourseVideo } from './entities/course-video.entity';
import { Course } from './entities/course.entity';
import {
  CourseEnrollmentSummary,
  CourseWithEnrollmentView,
} from './interfaces/course-with-enrollment.interface';

const COURSE_SORT_FIELDS = ['title', 'slug', 'status', 'createdAt', 'updatedAt'];

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private readonly coursesRepository: Repository<Course>,
    @InjectRepository(CourseEnrollment)
    private readonly enrollmentsRepository: Repository<CourseEnrollment>,
    @InjectRepository(CourseVideo)
    private readonly videosRepository: Repository<CourseVideo>,
    @InjectRepository(PaymentTransaction)
    private readonly transactionsRepository: Repository<PaymentTransaction>,
    private readonly userService: UserService,
    private readonly partnersService: PartnersService,
  ) {}

  // ─── Student reads ───────────────────────────────────────────────────────

  async findPublishedCourse(id: string): Promise<Course> {
    const course = await this.coursesRepository.findOne({
      where: { id, status: CourseStatus.PUBLISHED },
    });

    if (!course) {
      throw new NotFoundException(`Course ${id} not found or not published`);
    }

    return course;
  }

  getExpectedCourseAmount(course: Course): number {
    return resolveCoursePrice(course.price, course.discount, course.isFree);
  }

  async findEnrollment(userId: string, courseId: string): Promise<CourseEnrollment | null> {
    return this.enrollmentsRepository.findOne({
      where: { userId, courseId },
      relations: ['course', 'paymentTransaction'],
    });
  }

  async findPublishedCoursesForStudent(
    userId: string,
    partnerId: string | null,
  ): Promise<CourseWithEnrollmentView[]> {
    await this.assertOnboardedStudent(userId);

    if (!partnerId) {
      throw new ForbiddenException('Student is not linked to a partner');
    }

    const courses = await this.coursesRepository.find({
      where: { partnerId, status: CourseStatus.PUBLISHED },
      order: { createdAt: 'DESC' },
    });

    if (courses.length === 0) {
      return [];
    }

    const enrollments = await this.enrollmentsRepository.find({
      where: { userId, courseId: In(courses.map((course) => course.id)) },
    });
    const enrollmentByCourseId = new Map(
      enrollments.map((enrollment) => [enrollment.courseId, enrollment]),
    );

    return courses.map((course) =>
      this.toCourseWithEnrollment(
        course,
        enrollmentByCourseId.get(course.id) ?? null,
      ),
    );
  }

  async findPublishedCourseForStudent(
    courseId: string,
    userId: string,
    partnerId: string | null,
  ): Promise<CourseWithEnrollmentView> {
    await this.assertOnboardedStudent(userId);

    const course = await this.findPublishedCourse(courseId);
    this.assertCourseBelongsToPartner(course, partnerId);

    const enrollment = await this.findEnrollment(userId, course.id);
    return this.toCourseWithEnrollment(course, enrollment);
  }

  async findPublishedCourseBySlugForStudent(
    slug: string,
    userId: string,
    partnerId: string | null,
  ): Promise<CourseWithEnrollmentView> {
    await this.assertOnboardedStudent(userId);

    const course = await this.coursesRepository.findOne({
      where: { slug, status: CourseStatus.PUBLISHED },
    });

    if (!course) {
      throw new NotFoundException(`Course with slug "${slug}" not found`);
    }

    this.assertCourseBelongsToPartner(course, partnerId);

    const enrollment = await this.findEnrollment(userId, course.id);
    return this.toCourseWithEnrollment(course, enrollment);
  }

  async findEnrollmentsByUser(userId: string) {
    const enrollments = await this.enrollmentsRepository.find({
      where: { userId },
      relations: ['course'],
      order: { enrolledAt: 'DESC' },
    });

    return enrollments.map((enrollment) => ({
      id: enrollment.id,
      enrolledAt: enrollment.enrolledAt,
      unlockedAt: enrollment.unlockedAt,
      paymentStatus: enrollment.paymentStatus,
      course: enrollment.course
        ? this.toCourseWithEnrollment(enrollment.course, enrollment)
        : null,
    }));
  }

  async isUserEnrolled(userId: string, courseId: string): Promise<boolean> {
    const count = await this.enrollmentsRepository.count({
      where: { userId, courseId },
    });
    return count > 0;
  }

  async assertNotEnrolled(userId: string, courseId: string): Promise<void> {
    if (await this.isUserEnrolled(userId, courseId)) {
      throw new ConflictException('You are already enrolled in this course');
    }
  }

  // ─── Staff course CRUD ───────────────────────────────────────────────────

  async createCourse(dto: CreateCourseDto): Promise<Course> {
    await this.partnersService.findOneEntity(dto.partnerId);

    const slug = await this.resolveUniqueSlug(
      dto.slug ?? dto.title,
      dto.slug ? slugify(dto.slug) : undefined,
    );

    const course = this.coursesRepository.create({
      partnerId: dto.partnerId,
      slug,
      title: dto.title,
      description: dto.description ?? null,
      thumbnailUrl: dto.thumbnailUrl ?? null,
      price: dto.price ?? 0,
      discount: dto.discount ?? 0,
      isFree: dto.isFree ?? false,
      status: CourseStatus.DRAFT,
      partnerCommissionType: dto.partnerCommissionType ?? null,
      partnerCommissionValue: dto.partnerCommissionValue ?? null,
    });

    return this.coursesRepository.save(course);
  }

  async findAllCourses(query: PaginationQueryDto): Promise<PaginatedResult<Course>> {
    const skip = getPaginationSkip(query.page, query.limit);
    const sortBy = COURSE_SORT_FIELDS.includes(query.sortBy ?? '')
      ? query.sortBy!
      : 'createdAt';

    const qb = this.coursesRepository.createQueryBuilder('course');

    if (query.search) {
      qb.andWhere(
        '(course.title LIKE :search OR course.slug LIKE :search OR course.description LIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy(`course.${sortBy}`, query.sortOrder ?? SortOrder.DESC)
      .skip(skip)
      .take(query.limit);

    const [items, total] = await qb.getManyAndCount();
    return buildPaginatedResult(items, total, query);
  }

  async findCoursesForPartner(
    partnerId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<Course>> {
    const skip = getPaginationSkip(query.page, query.limit);
    const sortBy = COURSE_SORT_FIELDS.includes(query.sortBy ?? '')
      ? query.sortBy!
      : 'createdAt';

    const qb = this.coursesRepository
      .createQueryBuilder('course')
      .where('course.partnerId = :partnerId', { partnerId });

    if (query.search) {
      qb.andWhere('(course.title LIKE :search OR course.slug LIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    qb.orderBy(`course.${sortBy}`, query.sortOrder ?? SortOrder.DESC)
      .skip(skip)
      .take(query.limit);

    const [items, total] = await qb.getManyAndCount();
    return buildPaginatedResult(items, total, query);
  }

  async findCourseById(id: string): Promise<Course> {
    const course = await this.coursesRepository.findOneBy({ id });

    if (!course) {
      throw new NotFoundException(`Course ${id} not found`);
    }

    return course;
  }

  async updateCourse(id: string, dto: UpdateCourseDto): Promise<Course> {
    const course = await this.findCourseById(id);

    if (dto.partnerId) {
      await this.partnersService.findOneEntity(dto.partnerId);
      course.partnerId = dto.partnerId;
    }

    if (dto.title !== undefined) {
      course.title = dto.title;
    }

    if (dto.description !== undefined) {
      course.description = dto.description;
    }

    if (dto.thumbnailUrl !== undefined) {
      course.thumbnailUrl = dto.thumbnailUrl;
    }

    if (dto.price !== undefined) {
      course.price = dto.price;
    }

    if (dto.discount !== undefined) {
      course.discount = dto.discount;
    }

    if (dto.isFree !== undefined) {
      course.isFree = dto.isFree;
    }

    if (dto.partnerCommissionType !== undefined) {
      course.partnerCommissionType = dto.partnerCommissionType;
    }

    if (dto.partnerCommissionValue !== undefined) {
      course.partnerCommissionValue = dto.partnerCommissionValue;
    }

    if (dto.slug !== undefined) {
      course.slug = await this.resolveUniqueSlug(dto.slug, slugify(dto.slug), id);
    } else if (dto.title !== undefined) {
      course.slug = await this.resolveUniqueSlug(dto.title, undefined, id);
    }

    return this.coursesRepository.save(course);
  }

  async publishCourse(id: string, dto: PublishCourseDto): Promise<Course> {
    const course = await this.findCourseById(id);

    if (
      dto.status !== CourseStatus.PUBLISHED &&
      dto.status !== CourseStatus.DRAFT
    ) {
      throw new ConflictException('Publish status must be published or draft');
    }

    course.status = dto.status;
    return this.coursesRepository.save(course);
  }

  async disableCourse(id: string): Promise<Course> {
    const course = await this.findCourseById(id);
    course.status = CourseStatus.DISABLED;
    return this.coursesRepository.save(course);
  }

  // ─── Course videos ───────────────────────────────────────────────────────

  async getCourseVideos(courseId: string): Promise<CourseVideo[]> {
    await this.findCourseById(courseId);
    return this.videosRepository.find({
      where: { courseId },
      order: { position: 'ASC' },
    });
  }

  async getCourseVideosForUser(
    courseId: string,
    userId: string,
    roleName: RoleName,
  ): Promise<CourseVideo[]> {
    await this.findCourseById(courseId);

    const staffRoles: RoleName[] = [
      RoleName.SUPERADMIN,
      RoleName.ADMIN,
      RoleName.MANAGER,
    ];

    if (!staffRoles.includes(roleName)) {
      const enrolled = await this.isUserEnrolled(userId, courseId);

      if (!enrolled) {
        throw new ForbiddenException('You must enroll in this course to view videos');
      }
    }

    return this.getCourseVideos(courseId);
  }

  async addCourseVideo(
    courseId: string,
    dto: CreateCourseVideoDto,
  ): Promise<CourseVideo> {
    await this.findCourseById(courseId);

    const video = this.videosRepository.create({
      courseId,
      title: dto.title,
      vimeoUrl: dto.vimeoUrl,
      position: dto.position ?? 0,
      duration: dto.duration ?? null,
    });

    return this.videosRepository.save(video);
  }

  async updateCourseVideo(
    courseId: string,
    videoId: string,
    dto: UpdateCourseVideoDto,
  ): Promise<CourseVideo> {
    const video = await this.findCourseVideo(courseId, videoId);
    Object.assign(video, dto);
    return this.videosRepository.save(video);
  }

  async removeCourseVideo(courseId: string, videoId: string): Promise<void> {
    const video = await this.findCourseVideo(courseId, videoId);
    await this.videosRepository.remove(video);
  }

  // ─── Admin / partner reports ─────────────────────────────────────────────

  async findAllEnrollments(
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<CourseEnrollment>> {
    const skip = getPaginationSkip(query.page, query.limit);

    const qb = this.enrollmentsRepository
      .createQueryBuilder('enrollment')
      .leftJoinAndSelect('enrollment.user', 'user')
      .leftJoinAndSelect('enrollment.course', 'course')
      .orderBy('enrollment.enrolledAt', query.sortOrder ?? SortOrder.DESC)
      .skip(skip)
      .take(query.limit);

    const [items, total] = await qb.getManyAndCount();
    return buildPaginatedResult(items, total, query);
  }

  async findEnrollmentsForPartner(
    partnerId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<CourseEnrollment>> {
    const skip = getPaginationSkip(query.page, query.limit);

    const qb = this.enrollmentsRepository
      .createQueryBuilder('enrollment')
      .leftJoinAndSelect('enrollment.user', 'user')
      .leftJoinAndSelect('enrollment.course', 'course')
      .where('course.partnerId = :partnerId', { partnerId })
      .orderBy('enrollment.enrolledAt', query.sortOrder ?? SortOrder.DESC)
      .skip(skip)
      .take(query.limit);

    const [items, total] = await qb.getManyAndCount();
    return buildPaginatedResult(items, total, query);
  }

  async getPartnerRevenueSummary(partnerId: string) {
    const onboardingRows = await this.transactionsRepository
      .createQueryBuilder('tx')
      .select('SUM(tx.amount)', 'totalAmount')
      .addSelect('SUM(tx.partnerCut)', 'totalPartnerCut')
      .addSelect('COUNT(tx.id)', 'transactionCount')
      .where('tx.partnerId = :partnerId', { partnerId })
      .andWhere('tx.paidFor = :paidFor', { paidFor: PaidFor.ONBOARDING })
      .andWhere('tx.status = :status', { status: PaymentStatus.SUCCESS })
      .getRawOne<{ totalAmount: string; totalPartnerCut: string; transactionCount: string }>();

    const courseRows = await this.transactionsRepository
      .createQueryBuilder('tx')
      .select('SUM(tx.amount)', 'totalAmount')
      .addSelect('COUNT(tx.id)', 'transactionCount')
      .where('tx.partnerId = :partnerId', { partnerId })
      .andWhere('tx.paidFor = :paidFor', { paidFor: PaidFor.COURSE })
      .andWhere('tx.status = :status', { status: PaymentStatus.SUCCESS })
      .getRawOne<{ totalAmount: string; transactionCount: string }>();

    return {
      partnerId,
      onboarding: {
        totalAmount: Number(onboardingRows?.totalAmount ?? 0),
        partnerCut: Number(onboardingRows?.totalPartnerCut ?? 0),
        transactionCount: Number(onboardingRows?.transactionCount ?? 0),
      },
      courses: {
        totalAmount: Number(courseRows?.totalAmount ?? 0),
        partnerCut: 0,
        transactionCount: Number(courseRows?.transactionCount ?? 0),
      },
    };
  }

  async findOnboardingPayments(
    query: PaginationQueryDto,
    partnerId?: string,
  ): Promise<PaginatedResult<PaymentTransaction>> {
    return this.findPaymentsByType(PaidFor.ONBOARDING, query, partnerId);
  }

  async findCoursePayments(
    query: PaginationQueryDto,
    partnerId?: string,
  ): Promise<PaginatedResult<PaymentTransaction>> {
    return this.findPaymentsByType(PaidFor.COURSE, query, partnerId);
  }

  // ─── Serialization helpers ───────────────────────────────────────────────

  buildEnrollmentSummary(
    enrollment: CourseEnrollment | null | undefined,
  ): CourseEnrollmentSummary {
    if (!enrollment) {
      return {
        isEnrolled: false,
        enrollmentId: null,
        enrolledAt: null,
        unlockedAt: null,
      };
    }

    return {
      isEnrolled: true,
      enrollmentId: enrollment.id,
      enrolledAt: enrollment.enrolledAt,
      unlockedAt: enrollment.unlockedAt,
    };
  }

  toCourseWithEnrollment(
    course: Course,
    enrollment: CourseEnrollment | null,
  ): CourseWithEnrollmentView {
    return {
      id: course.id,
      partnerId: course.partnerId,
      slug: course.slug,
      title: course.title,
      description: course.description,
      thumbnailUrl: course.thumbnailUrl,
      price: Number(course.price),
      discount: Number(course.discount),
      isFree: course.isFree,
      effectivePrice: this.getExpectedCourseAmount(course),
      status: course.status,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      enrollment: this.buildEnrollmentSummary(enrollment),
    };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private async resolveUniqueSlug(
    source: string,
    explicitSlug?: string,
    excludeCourseId?: string,
  ): Promise<string> {
    const base = explicitSlug ?? slugify(source);

    return generateUniqueSlug(base, async (candidate) =>
      this.slugExists(candidate, excludeCourseId),
    );
  }

  private async slugExists(slug: string, excludeCourseId?: string): Promise<boolean> {
    const existing = await this.coursesRepository.findOne({ where: { slug } });

    if (!existing) {
      return false;
    }

    return existing.id !== excludeCourseId;
  }

  private async findCourseVideo(
    courseId: string,
    videoId: string,
  ): Promise<CourseVideo> {
    const video = await this.videosRepository.findOne({
      where: { id: videoId, courseId },
    });

    if (!video) {
      throw new NotFoundException(`Video ${videoId} not found for course ${courseId}`);
    }

    return video;
  }

  private async findPaymentsByType(
    paidFor: PaidFor,
    query: PaginationQueryDto,
    partnerId?: string,
  ): Promise<PaginatedResult<PaymentTransaction>> {
    const skip = getPaginationSkip(query.page, query.limit);

    const qb = this.transactionsRepository
      .createQueryBuilder('tx')
      .leftJoinAndSelect('tx.user', 'user')
      .leftJoinAndSelect('tx.partner', 'partner')
      .leftJoinAndSelect('tx.course', 'course')
      .where('tx.paidFor = :paidFor', { paidFor })
      .andWhere('tx.status = :status', { status: PaymentStatus.SUCCESS })
      .orderBy('tx.createdAt', query.sortOrder ?? SortOrder.DESC)
      .skip(skip)
      .take(query.limit);

    if (partnerId) {
      qb.andWhere('tx.partnerId = :partnerId', { partnerId });
    }

    const [items, total] = await qb.getManyAndCount();
    return buildPaginatedResult(items, total, query);
  }

  private async assertOnboardedStudent(userId: string): Promise<void> {
    const user = await this.userService.findByIdWithRole(userId);

    if (!user) {
      throw new NotFoundException('Student not found');
    }

    if (user.onboardingStatus !== OnboardingStatus.ONBOARDED) {
      throw new ForbiddenException(
        'Complete onboarding before browsing or purchasing courses',
      );
    }
  }

  private assertCourseBelongsToPartner(
    course: Course,
    partnerId: string | null,
  ): void {
    if (!partnerId || course.partnerId !== partnerId) {
      throw new NotFoundException('Course not found for your partner');
    }
  }
}
