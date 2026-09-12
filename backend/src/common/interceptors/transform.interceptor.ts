import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    requestId?: string;
  };
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const requestId =
      request?.traceId ??
      request?.headers?.['x-request-id'] ??
      request?.headers?.['x-correlation-id'];

    return next.handle().pipe(
      map((data) => {
        // Preserved enveloped responses
        if (
          data &&
          typeof data === 'object' &&
          'success' in data &&
          'data' in data
        ) {
          return data;
        }

        return {
          success: true,
          data,
          meta: {
            requestId: requestId ? String(requestId) : undefined,
          },
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
