import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ReportFilterQueryDto } from '../common/dto/report-filter-query.dto';
import { PaginatedResult } from '../common/interfaces/pagination.interface';
import { CourseStatus, PaidFor, PaymentStatus } from '../common/types/payment.types';
import { RoleName } from '../common/types/permission.types';
import { SortOrder } from '../common/types/sort-order.type';
import {
  buildPaginatedResult,
  getPaginationSkip,
} from '../common/utils/pagination.util';
import { generateUniqueSlug, slugify } from '../common/utils/slug.util';
import { PaymentTransaction } from '../payments/entities/payment-transaction.entity';
import { resolveCoursePrice } from '../payments/utils/payment.util';
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

  async findPublishedCoursesPublic(): Promise<CourseWithEnrollmentView[]> {
    const courses = await this.coursesRepository.find({
      where: { status: CourseStatus.PUBLISHED },
      order: { createdAt: 'DESC' },
    });

    return courses.map((course) => this.toCourseWithEnrollment(course, null));
  }

  async findPublishedCoursePublic(courseId: string): Promise<CourseWithEnrollmentView> {
    const course = await this.findPublishedCourse(courseId);
    return this.toCourseWithEnrollment(course, null);
  }

  async findPublishedCourseBySlugPublic(
    slug: string,
  ): Promise<CourseWithEnrollmentView> {
    const course = await this.coursesRepository.findOne({
      where: { slug, status: CourseStatus.PUBLISHED },
    });

    if (!course) {
      throw new NotFoundException(`Course with slug "${slug}" not found`);
    }

    return this.toCourseWithEnrollment(course, null);
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
    const slug = await this.resolveUniqueSlug(
      dto.slug ?? dto.title,
      dto.slug ? slugify(dto.slug) : undefined,
    );

    const course = this.coursesRepository.create({
      slug,
      title: dto.title,
      description: dto.description ?? null,
      thumbnailUrl: dto.thumbnailUrl,
      price: dto.price ?? 0,
      discount: dto.discount ?? 0,
      isFree: dto.isFree ?? false,
      status: CourseStatus.DRAFT,
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

  async findCourseById(id: string): Promise<Course> {
    const course = await this.coursesRepository.findOneBy({ id });

    if (!course) {
      throw new NotFoundException(`Course ${id} not found`);
    }

    return course;
  }

  async updateCourse(id: string, dto: UpdateCourseDto): Promise<Course> {
    const course = await this.findCourseById(id);

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

  async removeCourse(id: string): Promise<void> {
    const course = await this.findCourseById(id);

    const enrollmentCount = await this.enrollmentsRepository.count({
      where: { courseId: id },
    });

    if (enrollmentCount > 0) {
      throw new ConflictException(
        'Cannot delete a course that has enrollments. Disable it instead.',
      );
    }

    const transactionCount = await this.transactionsRepository.count({
      where: { courseId: id },
    });

    if (transactionCount > 0) {
      throw new ConflictException(
        'Cannot delete a course linked to payment transactions. Disable it instead.',
      );
    }

    await this.videosRepository.delete({ courseId: id });
    await this.coursesRepository.remove(course);
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
      details: dto.details ?? null,
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
    query: ReportFilterQueryDto,
  ): Promise<PaginatedResult<CourseEnrollment>> {
    const skip = getPaginationSkip(query.page, query.limit);
    const qb = this.buildEnrollmentsQuery(query);
    qb.skip(skip).take(query.limit);
    const [items, total] = await qb.getManyAndCount();
    return buildPaginatedResult(items, total, query);
  }

  async findEnrollmentById(
    id: string,
    scopedPartnerId?: string,
  ): Promise<CourseEnrollment> {
    const enrollment = await this.enrollmentsRepository.findOne({
      where: { id },
      relations: ['user', 'course', 'paymentTransaction'],
    });

    if (!enrollment) {
      throw new NotFoundException(`Enrollment ${id} not found`);
    }

    if (
      scopedPartnerId &&
      enrollment.user?.partnerId !== scopedPartnerId
    ) {
      throw new NotFoundException(`Enrollment ${id} not found`);
    }

    return enrollment;
  }

  async findEnrollmentsForPartner(
    partnerId: string,
    query: ReportFilterQueryDto,
  ): Promise<PaginatedResult<CourseEnrollment>> {
    const skip = getPaginationSkip(query.page, query.limit);
    const qb = this.buildEnrollmentsQuery(query, partnerId);
    qb.skip(skip).take(query.limit);
    const [items, total] = await qb.getManyAndCount();
    return buildPaginatedResult(items, total, query);
  }

  async findCourseBySlugForStaff(slug: string): Promise<Course> {
    const course = await this.coursesRepository.findOne({ where: { slug } });

    if (!course) {
      throw new NotFoundException(`Course with slug "${slug}" not found`);
    }

    return course;
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
    query: ReportFilterQueryDto,
    partnerId?: string,
  ): Promise<PaginatedResult<PaymentTransaction>> {
    return this.findPaymentsByType(PaidFor.ONBOARDING, query, partnerId);
  }

  async findCoursePayments(
    query: ReportFilterQueryDto,
    partnerId?: string,
  ): Promise<PaginatedResult<PaymentTransaction>> {
    return this.findPaymentsByType(PaidFor.COURSE, query, partnerId);
  }

  async findAdminPayments(
    query: ReportFilterQueryDto,
  ): Promise<PaginatedResult<PaymentTransaction>> {
    const skip = getPaginationSkip(query.page, query.limit);

    const qb = this.transactionsRepository
      .createQueryBuilder('tx')
      .leftJoinAndSelect('tx.user', 'user')
      .leftJoinAndSelect('tx.partner', 'partner')
      .leftJoinAndSelect('tx.course', 'course')
      .orderBy('tx.createdAt', query.sortOrder ?? SortOrder.DESC)
      .skip(skip)
      .take(query.limit);

    if (query.paidFor) {
      qb.andWhere('tx.paidFor = :paidFor', { paidFor: query.paidFor });
    }

    if (query.paymentStatus) {
      qb.andWhere('tx.status = :paymentStatus', {
        paymentStatus: query.paymentStatus,
      });
    }

    if (query.partnerId) {
      qb.andWhere('tx.partnerId = :partnerId', { partnerId: query.partnerId });
    }

    if (query.courseId) {
      qb.andWhere('tx.courseId = :courseId', { courseId: query.courseId });
    }

    if (query.dateFrom) {
      qb.andWhere('tx.createdAt >= :dateFrom', { dateFrom: query.dateFrom });
    }

    if (query.dateTo) {
      qb.andWhere('tx.createdAt <= :dateTo', {
        dateTo: `${query.dateTo} 23:59:59`,
      });
    }

    if (query.search) {
      qb.andWhere(
        '(tx.txRef LIKE :search OR tx.externalTransactionId LIKE :search OR user.email LIKE :search OR user.firstName LIKE :search OR user.lastName LIKE :search OR course.title LIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [items, total] = await qb.getManyAndCount();
    return buildPaginatedResult(items, total, query);
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

  private buildEnrollmentsQuery(
    query: ReportFilterQueryDto,
    scopedPartnerId?: string,
  ) {
    const qb = this.enrollmentsRepository
      .createQueryBuilder('enrollment')
      .leftJoinAndSelect('enrollment.user', 'user')
      .leftJoinAndSelect('enrollment.course', 'course');

    const partnerId = scopedPartnerId ?? query.partnerId;
    if (partnerId) {
      qb.andWhere('user.partnerId = :partnerId', { partnerId });
    }

    if (query.courseId) {
      qb.andWhere('enrollment.courseId = :courseId', {
        courseId: query.courseId,
      });
    }

    if (query.studentId) {
      qb.andWhere('enrollment.userId = :studentId', {
        studentId: query.studentId,
      });
    }

    if (query.dateFrom) {
      qb.andWhere('enrollment.enrolledAt >= :dateFrom', {
        dateFrom: query.dateFrom,
      });
    }

    if (query.dateTo) {
      qb.andWhere('enrollment.enrolledAt <= :dateTo', {
        dateTo: `${query.dateTo} 23:59:59`,
      });
    }

    if (query.search) {
      qb.andWhere(
        '(course.title LIKE :search OR user.firstName LIKE :search OR user.lastName LIKE :search OR user.email LIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    return qb.orderBy(
      'enrollment.enrolledAt',
      query.sortOrder ?? SortOrder.DESC,
    );
  }

  private async findPaymentsByType(
    paidFor: PaidFor,
    query: ReportFilterQueryDto,
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

    const effectivePartnerId = partnerId ?? query.partnerId;
    if (effectivePartnerId) {
      qb.andWhere('tx.partnerId = :partnerId', { partnerId: effectivePartnerId });
    }

    if (query.courseId) {
      qb.andWhere('tx.courseId = :courseId', { courseId: query.courseId });
    }

    if (query.dateFrom) {
      qb.andWhere('tx.createdAt >= :dateFrom', { dateFrom: query.dateFrom });
    }

    if (query.dateTo) {
      qb.andWhere('tx.createdAt <= :dateTo', {
        dateTo: `${query.dateTo} 23:59:59`,
      });
    }

    if (query.search) {
      qb.andWhere(
        '(tx.txRef LIKE :search OR user.email LIKE :search OR user.firstName LIKE :search OR user.lastName LIKE :search OR course.title LIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [items, total] = await qb.getManyAndCount();
    return buildPaginatedResult(items, total, query);
  }

}
