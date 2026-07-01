export interface ApiSuccessResponse<T = unknown> {
  status: true;
  message: string;
  data: T;
}

export interface ApiErrorResponse {
  status: false;
  message: string;
  error: string | string[] | Record<string, unknown>;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
