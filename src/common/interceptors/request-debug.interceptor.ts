import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

@Injectable()
export class RequestDebugInterceptor implements NestInterceptor {
  constructor(private readonly configService: ConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.isEnabled()) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<{
      method: string;
      originalUrl: string;
      query: Record<string, unknown>;
      user?: AuthenticatedUser;
      headers: { authorization?: string };
    }>();
    const handler = context.getHandler().name;
    const controller = context.getClass().name;
    const startedAt = Date.now();

    const hasBearer = Boolean(request.headers.authorization?.startsWith('Bearer '));
    const user = request.user;

    console.log(
      '[REQUEST]',
      request.method,
      request.originalUrl,
      '| auth:',
      user
        ? `${user.email} (${user.role.name})`
        : hasBearer
          ? 'invalid/expired token'
          : 'none (public)',
      `| handler: ${controller}.${handler}`,
    );

    if (Object.keys(request.query ?? {}).length > 0) {
      console.log('[REQUEST] query:', request.query);
    }

    return next.handle().pipe(
      tap((body) => {
        const ms = Date.now() - startedAt;
        const response = http.getResponse<{ statusCode: number }>();
        const summary = this.summarizeBody(body);

        console.log(
          '[RESPONSE]',
          request.method,
          request.originalUrl,
          '|',
          response.statusCode,
          `| ${ms}ms`,
          summary ? `| ${summary}` : '',
        );
      }),
      catchError((error: unknown) => {
        const ms = Date.now() - startedAt;
        const summary = summarizeError(error);

        console.log(
          '[RESPONSE]',
          request.method,
          request.originalUrl,
          '|',
          summary.status,
          `| ${ms}ms`,
          '|',
          summary.message,
        );

        if (summary.detail) {
          console.error('[RESPONSE] error detail:', summary.detail);
        }

        return throwError(() => error);
      }),
    );
  }

  private isEnabled(): boolean {
    const explicit = this.configService.get<string>('app.debugRequestLogs');

    if (explicit !== undefined && explicit !== '') {
      return ['true', '1', 'yes', 'on'].includes(explicit.toLowerCase());
    }

    return this.configService.get<string>('NODE_ENV') === 'development';
  }

  private summarizeBody(body: unknown): string | null {
    if (!body || typeof body !== 'object') {
      return null;
    }

    const payload = body as Record<string, unknown>;
    const data = payload.data;

    if (Array.isArray(data)) {
      return `items: ${data.length}`;
    }

    if (data && typeof data === 'object') {
      const nested = data as Record<string, unknown>;

      if (Array.isArray(nested.data) && nested.meta && typeof nested.meta === 'object') {
        const meta = nested.meta as { total?: number };
        return `paginated total: ${meta.total ?? nested.data.length}`;
      }
    }

    return null;
  }
}

function summarizeError(error: unknown): {
  status: number | string;
  message: string;
  detail?: string;
} {
  if (!error || typeof error !== 'object') {
    return { status: 'ERROR', message: String(error) };
  }

  const err = error as {
    status?: number;
    message?: string | string[];
    name?: string;
    stack?: string;
    response?: unknown;
    $metadata?: { httpStatusCode?: number; requestId?: string };
    Code?: string;
    code?: string;
  };

  const status = err.status ?? err.$metadata?.httpStatusCode ?? 'ERROR';
  let message = 'Request failed';

  if (typeof err.message === 'string' && err.message.trim()) {
    message = err.message;
  } else if (Array.isArray(err.message) && err.message.length) {
    message = err.message.join('; ');
  } else if (err.name) {
    message = err.name;
  }

  // Prefer structured AWS/SDK fields over a bare "UnknownError" message.
  if (message === 'UnknownError' || err.$metadata) {
    const bits = [
      err.name,
      err.Code ?? err.code,
      err.$metadata?.httpStatusCode
        ? `HTTP ${err.$metadata.httpStatusCode}`
        : null,
      err.$metadata?.requestId
        ? `requestId=${err.$metadata.requestId}`
        : null,
    ].filter(Boolean);
    if (bits.length) {
      message = bits.join(' | ');
    }
  }

  const detailParts: string[] = [];
  if (err.response && typeof err.response === 'object') {
    const body = err.response as { message?: string | string[] };
    if (typeof body.message === 'string') {
      detailParts.push(body.message);
    } else if (Array.isArray(body.message)) {
      detailParts.push(body.message.join('; '));
    }
  }
  if (err.stack) {
    detailParts.push(err.stack.split('\n').slice(0, 8).join('\n'));
  }

  return {
    status,
    message,
    detail: detailParts.length ? detailParts.join('\n') : undefined,
  };
}
