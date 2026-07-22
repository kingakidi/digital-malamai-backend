export interface CourseEnrollmentSummary {
  isEnrolled: boolean;
  enrollmentId: string | null;
  enrolledAt: Date | null;
  unlockedAt: Date | null;
}

export interface CourseWithEnrollmentView {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  price: number;
  discount: number;
  isFree: boolean;
  effectivePrice: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  enrollment: CourseEnrollmentSummary;
}
