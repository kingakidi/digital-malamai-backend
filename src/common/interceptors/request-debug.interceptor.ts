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
      catchError((error: { status?: number; message?: string }) => {
        const ms = Date.now() - startedAt;
        console.log(
          '[RESPONSE]',
          request.method,
          request.originalUrl,
          '|',
          error.status ?? 'ERROR',
          `| ${ms}ms`,
          '|',
          error.message ?? 'Request failed',
        );
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
