export enum PaymentPlatform {
  FLUTTERWAVE = 'Flutterwave',
}

export enum PaidFor {
  ONBOARDING = 'onboarding',
  COURSE = 'course',
}

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

export enum CommissionType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

export enum CourseStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  DISABLED = 'disabled',
}

export interface PaymentMetadata {
  paidFor?: PaidFor | string;
  email?: string;
  courseId?: string;
  partnerId?: string;
  accessCode?: string;
  fullName?: string;
  phone?: string;
}

export interface FlutterwaveVerifyData {
  id: number | string;
  tx_ref: string;
  flw_ref?: string;
  amount: number;
  charged_amount?: number;
  currency: string;
  status: string;
  app_fee?: number;
  merchant_fee?: number;
  meta?: PaymentMetadata | string | Record<string, unknown>;
  customer?: {
    email?: string;
    name?: string;
    phone_number?: string;
    phonenumber?: string;
  };
}

export interface FlutterwaveVerifyResponse {
  status: string;
  message: string;
  data: FlutterwaveVerifyData;
}

export interface FlutterwaveTransactionsListResponse {
  status: string;
  message: string;
  meta?: {
    page_info?: {
      total: number;
      current_page: number;
      total_pages: number;
    };
  };
  data: FlutterwaveVerifyData[];
}

export interface FlutterwaveWebhookPayload {
  id?: string;
  type?: string;
  event?: string;
  timestamp?: number;
  data: FlutterwaveVerifyData | Record<string, unknown>;
}
