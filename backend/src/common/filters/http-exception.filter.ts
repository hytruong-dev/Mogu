import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      message =
        typeof response === 'object' ? response : { message: response };

      if (status === HttpStatus.BAD_REQUEST) {
        const payload = message as Record<string, unknown>;
        const error = payload.error as Record<string, unknown> | undefined;
        const details = error?.details;
        if (Array.isArray(details) && details.length > 0) {
          this.logger.warn(
            `Validation failed ${request.method} ${request.url}: ${JSON.stringify(details)}`,
          );
        }
      }

      if (status === HttpStatus.CONFLICT) {
        const payload = message as Record<string, unknown>;
        const error = payload.error as Record<string, unknown> | undefined;
        this.logger.warn(
          `Conflict ${request.method} ${request.url}: ${JSON.stringify(error ?? payload)}`,
        );
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    }

    reply.status(status).send({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(typeof message === 'object' ? message : { message }),
    });
  }
}
