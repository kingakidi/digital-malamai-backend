import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { HTTP_STATUS_MESSAGES } from '../constants/http-status-messages.constants';
import { ApiErrorResponse } from '../interfaces/api-response.interface';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message =
      HTTP_STATUS_MESSAGES[HttpStatus.INTERNAL_SERVER_ERROR] ??
      'Internal Server Error';
    let error: ApiErrorResponse['error'] = message;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const statusLabel =
        HTTP_STATUS_MESSAGES[status] ?? HttpStatus[status] ?? 'Error';

      message = statusLabel;
      error = statusLabel;

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = statusLabel;
      } else if (typeof exceptionResponse === 'object') {
        const body = exceptionResponse as Record<string, unknown>;

        if (Array.isArray(body.message)) {
          message = 'Validation failed';
          error = body.message as string[];
        } else if (typeof body.message === 'string') {
          message = body.message;
          error = typeof body.error === 'string' ? body.error : statusLabel;
        } else {
          message = statusLabel;
          error = (body.error as string) ?? statusLabel;
        }
      }
    }

    const payload: ApiErrorResponse = {
      status: false,
      message,
      error,
    };

    response.status(status).json(payload);
  }
}
