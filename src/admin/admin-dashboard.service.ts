import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Partner } from '../partners/entities/partner.entity';
import { PaymentTransaction } from '../payments/entities/payment-transaction.entity';
import { User } from '../user/entities/user.entity';
import { PaidFor, PaymentStatus } from '../common/types/payment.types';
import { RoleName } from '../common/types/permission.types';
import { toAmount } from '../common/utils/number.util';
import { SortOrder } from '../common/types/sort-order.type';
import { StudentsService } from '../students/students.service';

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

interface TrendPoint {
  label: string;
  onboarding: number;
  course: number;
}

export interface DashboardOverviewResponse {
  stats: {
    totalStudents: number;
    studentsTrendPercent: number;
    totalPartners: number;
    partnersTrendPercent: number;
    totalUsers: number;
    totalOnboardingFees: number;
    onboardingFeesTrendPercent: number;
    totalCourseFees: number;
    courseFeesTrendPercent: number;
  };
  paymentTrend: {
    totalBalance: number;
    balanceTrendPercent: number;
    ranges: Record<string, TrendPoint[]>;
  };
  paymentBreakdown: Array<{
    id: string;
    label: string;
    value: number;
    color: string;
  }>;
  students: Awaited<
    ReturnType<StudentsService['findAllStudents']>
  >['data'];
}

@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectRepository(PaymentTransaction)
    private readonly transactionsRepository: Repository<PaymentTransaction>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Partner)
    private readonly partnersRepository: Repository<Partner>,
    private readonly studentsService: StudentsService,
  ) {}

  async getOverview(): Promise<DashboardOverviewResponse> {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const [
      totalStudents,
      totalPartners,
      totalUsers,
      onboardingPayments,
      coursePayments,
      recentStudents,
    ] = await Promise.all([
      this.countStudents(),
      this.partnersRepository.count(),
      this.countStaffUsers(),
      this.fetchSuccessfulPayments(PaidFor.ONBOARDING, twelveMonthsAgo),
      this.fetchSuccessfulPayments(PaidFor.COURSE, twelveMonthsAgo),
      this.studentsService.findAllStudents({
        page: 1,
        limit: 50,
        sortOrder: SortOrder.DESC,
      }),
    ]);

    const totalOnboardingFees = this.sumAmounts(onboardingPayments);
    const totalCourseFees = this.sumAmounts(coursePayments);
    const totalBalance = totalOnboardingFees + totalCourseFees;
    const allPayments = [...onboardingPayments, ...coursePayments];

    const [
      studentsTrendPercent,
      partnersTrendPercent,
      onboardingFeesTrendPercent,
      courseFeesTrendPercent,
      balanceTrendPercent,
    ] = await Promise.all([
      this.computeEntityTrend((from, to) => this.countStudentsInPeriod(from, to)),
      this.computeEntityTrend((from, to) => this.countPartnersInPeriod(from, to)),
      Promise.resolve(this.computePaymentTrend(onboardingPayments)),
      Promise.resolve(this.computePaymentTrend(coursePayments)),
      Promise.resolve(this.computePaymentTrend(allPayments)),
    ]);

    return {
      stats: {
        totalStudents,
        studentsTrendPercent,
        totalPartners,
        partnersTrendPercent,
        totalUsers,
        totalOnboardingFees,
        onboardingFeesTrendPercent,
        totalCourseFees,
        courseFeesTrendPercent,
      },
      paymentTrend: {
        totalBalance,
        balanceTrendPercent,
        ranges: {
          '7d': this.buildDailyTrend(onboardingPayments, coursePayments, 7),
          '30d': this.buildWeeklyTrend(onboardingPayments, coursePayments, 30, 6),
          '12m': this.buildMonthlyTrend(onboardingPayments, coursePayments, 12),
        },
      },
      paymentBreakdown: this.buildBreakdown(onboardingPayments, coursePayments),
      students: recentStudents.data,
    };
  }

  private async countStudentsInPeriod(from: Date, to: Date): Promise<number> {
    return this.usersRepository
      .createQueryBuilder('user')
      .innerJoin('user.role', 'role')
      .where('role.name = :roleName', { roleName: RoleName.STUDENT })
      .andWhere('user.createdAt >= :from', { from })
      .andWhere('user.createdAt < :to', { to })
      .getCount();
  }

  private async countPartnersInPeriod(from: Date, to: Date): Promise<number> {
    return this.partnersRepository
      .createQueryBuilder('partner')
      .where('partner.createdAt >= :from', { from })
      .andWhere('partner.createdAt < :to', { to })
      .getCount();
  }

  private async computeEntityTrend(
    counter: (from: Date, to: Date) => Promise<number>,
    periodDays = 30,
  ): Promise<number> {
    const now = new Date();
    const currentFrom = this.subtractDays(now, periodDays);
    const previousFrom = this.subtractDays(now, periodDays * 2);
    const [current, previous] = await Promise.all([
      counter(currentFrom, now),
      counter(previousFrom, currentFrom),
    ]);
    return this.computeTrendPercent(current, previous);
  }

  private computePaymentTrend(
    payments: PaymentTransaction[],
    periodDays = 30,
  ): number {
    const now = Date.now();
    const dayMs = 86_400_000;
    const currentFrom = now - periodDays * dayMs;
    const previousFrom = now - periodDays * 2 * dayMs;
    const current = this.sumPaymentsBetween(payments, currentFrom, now);
    const previous = this.sumPaymentsBetween(payments, previousFrom, currentFrom);
    return this.computeTrendPercent(current, previous);
  }

  private sumPaymentsBetween(
    payments: PaymentTransaction[],
    fromMs: number,
    toMs: number,
  ): number {
    return payments
      .filter((payment) => {
        const time = new Date(payment.createdAt).getTime();
        return time >= fromMs && time < toMs;
      })
      .reduce((total, payment) => total + toAmount(payment.amount), 0);
  }

  private computeTrendPercent(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return Math.round(((current - previous) / previous) * 100);
  }

  private subtractDays(date: Date, days: number): Date {
    const copy = new Date(date);
    copy.setDate(copy.getDate() - days);
    return copy;
  }

  private async countStudents(): Promise<number> {
    return this.usersRepository
      .createQueryBuilder('user')
      .innerJoin('user.role', 'role')
      .where('role.name = :roleName', { roleName: RoleName.STUDENT })
      .getCount();
  }

  private async countStaffUsers(): Promise<number> {
    return this.usersRepository
      .createQueryBuilder('user')
      .innerJoin('user.role', 'role')
      .where('role.name IN (:...roles)', {
        roles: [
          RoleName.SUPERADMIN,
          RoleName.ADMIN,
          RoleName.MANAGER,
          RoleName.PARTNER,
        ],
      })
      .getCount();
  }

  private async fetchSuccessfulPayments(
    paidFor: PaidFor,
    since: Date,
  ): Promise<PaymentTransaction[]> {
    return this.transactionsRepository
      .createQueryBuilder('tx')
      .where('tx.paidFor = :paidFor', { paidFor })
      .andWhere('tx.status = :status', { status: PaymentStatus.SUCCESS })
      .andWhere('tx.createdAt >= :since', { since })
      .orderBy('tx.createdAt', 'ASC')
      .getMany();
  }

  private sumAmounts(payments: PaymentTransaction[]): number {
    return payments.reduce((total, payment) => total + toAmount(payment.amount), 0);
  }

  private bucketAmount(
    payments: PaymentTransaction[],
    fromMs: number,
    toMs: number,
  ): number {
    return payments
      .filter((payment) => {
        const time = new Date(payment.createdAt).getTime();
        return time >= fromMs && time < toMs;
      })
      .reduce((total, payment) => total + toAmount(payment.amount), 0);
  }

  private buildDailyTrend(
    onboarding: PaymentTransaction[],
    courses: PaymentTransaction[],
    days: number,
  ): TrendPoint[] {
    const now = Date.now();
    return Array.from({ length: days }, (_, index) => {
      const fromDaysAgo = days - index;
      const toDaysAgo = days - index - 1;
      const from = now - fromDaysAgo * 86_400_000;
      const to = now - toDaysAgo * 86_400_000;
      return {
        label: `Day ${index + 1}`,
        onboarding: this.bucketAmount(onboarding, from, to),
        course: this.bucketAmount(courses, from, to),
      };
    });
  }

  private buildWeeklyTrend(
    onboarding: PaymentTransaction[],
    courses: PaymentTransaction[],
    totalDays: number,
    buckets: number,
  ): TrendPoint[] {
    const now = Date.now();
    const step = totalDays / buckets;
    return Array.from({ length: buckets }, (_, index) => {
      const fromDaysAgo = totalDays - index * step;
      const toDaysAgo = totalDays - (index + 1) * step;
      const from = now - fromDaysAgo * 86_400_000;
      const to = now - toDaysAgo * 86_400_000;
      return {
        label: `${Math.round(index * step) + 1}-${Math.round((index + 1) * step)}d`,
        onboarding: this.bucketAmount(onboarding, from, to),
        course: this.bucketAmount(courses, from, to),
      };
    });
  }

  private buildMonthlyTrend(
    onboarding: PaymentTransaction[],
    courses: PaymentTransaction[],
    months: number,
  ): TrendPoint[] {
    return Array.from({ length: months }, (_, index) => {
      const monthsAgo = months - 1 - index;
      const ref = new Date();
      ref.setMonth(ref.getMonth() - monthsAgo);
      const year = ref.getFullYear();
      const month = ref.getMonth();

      const inMonth = (payment: PaymentTransaction) => {
        const date = new Date(payment.createdAt);
        return date.getFullYear() === year && date.getMonth() === month;
      };

      return {
        label: MONTH_LABELS[month],
        onboarding: onboarding
          .filter(inMonth)
          .reduce((total, payment) => total + toAmount(payment.amount), 0),
        course: courses
          .filter(inMonth)
          .reduce((total, payment) => total + toAmount(payment.amount), 0),
      };
    });
  }

  private buildBreakdown(
    onboarding: PaymentTransaction[],
    courses: PaymentTransaction[],
  ) {
    const onboardingTotal = this.sumAmounts(onboarding);
    const courseTotal = this.sumAmounts(courses);

    return [
      { id: 'onboarding', label: 'Onboarding Fees', value: onboardingTotal, color: '#306eb7' },
      { id: 'course', label: 'Course Fees', value: courseTotal, color: '#234f84' },
    ];
  }
}
