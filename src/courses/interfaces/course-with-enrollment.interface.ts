export interface CourseEnrollmentSummary {
  isEnrolled: boolean;
  enrollmentId: string | null;
  enrolledAt: Date | null;
  unlockedAt: Date | null;
}

export interface CourseCategorySummary {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
  isDefault: boolean;
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
  categoryId: string;
  category: CourseCategorySummary | null;
  createdAt: Date;
  updatedAt: Date;
  enrollment: CourseEnrollmentSummary;
}
