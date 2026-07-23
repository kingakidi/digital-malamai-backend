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

function sanitizeMessage(message: string): string {
  return message.replace(/^[A-Za-z][A-Za-z0-9_]*Exception:\s*/g, '').trim();
}

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
        HTTP_STATUS_MESSAGES[status] ??
        (status === HttpStatus.TOO_MANY_REQUESTS
          ? 'Too many requests'
          : (HttpStatus[status] ?? 'Error'));

      message = statusLabel;
      error = statusLabel;

      if (typeof exceptionResponse === 'string') {
        message = sanitizeMessage(exceptionResponse) || statusLabel;
        error = statusLabel;
      } else if (typeof exceptionResponse === 'object') {
        const body = exceptionResponse as Record<string, unknown>;

        if (Array.isArray(body.message)) {
          message = 'Validation failed';
          error = body.message as string[];
        } else if (typeof body.message === 'string') {
          message = sanitizeMessage(body.message) || statusLabel;
          error =
            typeof body.error === 'string' &&
            !/[A-Za-z]+Exception$/i.test(body.error)
              ? body.error
              : statusLabel;
        } else {
          message = statusLabel;
          error = statusLabel;
        }
      }

      if (status === HttpStatus.TOO_MANY_REQUESTS) {
        message = 'Too many requests';
        error = 'Too many requests';
      }
    } else if (exception instanceof Error) {
      console.error(
        '[HttpExceptionFilter] Unhandled error:',
        exception.name,
        exception.message,
        exception.stack,
      );
    } else {
      console.error('[HttpExceptionFilter] Unhandled non-Error:', exception);
    }

    const payload: ApiErrorResponse = {
      status: false,
      message,
      error,
    };

    response.status(status).json(payload);
  }
}
