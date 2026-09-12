import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';

export interface ApiErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    retryable?: boolean;
  };
  requestId: string;
  timestamp: string;
}

const STATUS_CODE_MAP: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.PRECONDITION_FAILED]: 'PRECONDITION_REQUIRED',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMIT_EXCEEDED',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest & { traceId?: string }>();

    const requestId =
      request.traceId ??
      (request.headers['x-request-id'] as string) ??
      (request.headers['x-correlation-id'] as string) ??
      crypto.randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'Đã có lỗi xảy ra từ máy chủ.';
    let details: unknown = undefined;
    let retryable = false;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'object' && res !== null) {
        const payload = res as Record<string, any>;
        const innerError = payload.error;

        if (typeof innerError === 'object' && innerError !== null) {
          code = innerError.code ?? STATUS_CODE_MAP[status] ?? 'ERROR';
          message = innerError.message ?? payload.message ?? exception.message;
          details = innerError.details ?? payload.details;
          retryable = innerError.retryable ?? status === 503;
        } else if (typeof innerError === 'string') {
          code = innerError.toUpperCase().replace(/\s+/g, '_');
          message =
            typeof payload.message === 'string'
              ? payload.message
              : Array.isArray(payload.message)
                ? payload.message.join('; ')
                : exception.message;
          details = payload.details;
        } else {
          code = STATUS_CODE_MAP[status] ?? 'ERROR';
          message =
            typeof payload.message === 'string'
              ? payload.message
              : Array.isArray(payload.message)
                ? payload.message.join('; ')
                : exception.message;
          details = payload.details;
        }
      } else if (typeof res === 'string') {
        message = res;
        code = STATUS_CODE_MAP[status] ?? 'ERROR';
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
      message = exception.message;
    }

    if (status === 503) {
      retryable = true;
    }

    reply.status(status).send({
      success: false,
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
        retryable,
      },
      requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
