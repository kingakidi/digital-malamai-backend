import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNoContentResponse,
  ApiOkResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  ApiErrorResponseDto,
  ApiSuccessResponseBaseDto,
  PaginationMetaDto,
} from './api-response.dto';

export interface ApiDataResponseOptions {
  type?: Type<unknown>;
  status?: 200 | 201;
  isArray?: boolean;
  isPaginated?: boolean;
  nullable?: boolean;
}

function collectModels(options: ApiDataResponseOptions): Type<unknown>[] {
  const models: Type<unknown>[] = [ApiErrorResponseDto, ApiSuccessResponseBaseDto];

  if (options.isPaginated) {
    models.push(PaginationMetaDto);
  }

  if (options.type) {
    models.push(options.type);
  }

  return models;
}

function buildDataSchema(options: ApiDataResponseOptions) {
  if (options.nullable) {
    return { nullable: true, example: null };
  }

  if (!options.type) {
    return { nullable: true };
  }

  if (options.isPaginated) {
    return {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(options.type) },
        },
        meta: { $ref: getSchemaPath(PaginationMetaDto) },
      },
      required: ['data', 'meta'],
    };
  }

  if (options.isArray) {
    return {
      type: 'array',
      items: { $ref: getSchemaPath(options.type) },
    };
  }

  return { $ref: getSchemaPath(options.type) };
}

export function ApiDataResponse(options: ApiDataResponseOptions = {}) {
  const status = options.status ?? 200;
  const SuccessDecorator = status === 201 ? ApiCreatedResponse : ApiOkResponse;

  return applyDecorators(
    ApiExtraModels(...collectModels(options)),
    SuccessDecorator({
      description:
        status === 201
          ? 'Resource created. Body: `{ status: true, message, data }`'
          : 'Request succeeded. Body: `{ status: true, message, data }`',
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiSuccessResponseBaseDto) },
          {
            type: 'object',
            properties: {
              data: buildDataSchema(options),
            },
          },
        ],
      },
    }),
    ApiBadRequestResponse({
      description: 'Validation failed or invalid request. Body: `{ status: false, message, error }`',
      type: ApiErrorResponseDto,
    }),
  );
}

export const ApiOkData = (
  type: Type<unknown>,
  options: Omit<ApiDataResponseOptions, 'type' | 'status'> = {},
) => ApiDataResponse({ ...options, type, status: 200 });

export const ApiCreatedData = (
  type: Type<unknown>,
  options: Omit<ApiDataResponseOptions, 'type' | 'status'> = {},
) => ApiDataResponse({ ...options, type, status: 201 });

export const ApiOkPaginated = (type: Type<unknown>) =>
  ApiDataResponse({ type, isPaginated: true, status: 200 });

export const ApiCreatedPaginated = (type: Type<unknown>) =>
  ApiDataResponse({ type, isPaginated: true, status: 201 });

export const ApiOkNull = () =>
  ApiDataResponse({ nullable: true, status: 200 });

export function ApiNoContentData() {
  return applyDecorators(
    ApiExtraModels(ApiErrorResponseDto),
    ApiNoContentResponse({ description: 'Resource deleted successfully (HTTP 204, no body)' }),
    ApiBadRequestResponse({
      description: 'Validation failed or invalid request. Body: `{ status: false, message, error }`',
      type: ApiErrorResponseDto,
    }),
  );
}
