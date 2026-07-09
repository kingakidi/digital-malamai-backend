import { PaginatedResult } from '../interfaces/pagination.interface';

interface PaginationInput {
  page: number;
  limit: number;
}

export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  pagination: PaginationInput,
): PaginatedResult<T> {
  const totalPages = total === 0 ? 1 : Math.ceil(total / pagination.limit);

  return {
    data,
    meta: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages,
      hasNextPage: pagination.page < totalPages,
      hasPreviousPage: pagination.page > 1 && totalPages > 0,
    },
  };
}

export function getPaginationSkip(page: number, limit: number): number {
  return (page - 1) * limit;
}
