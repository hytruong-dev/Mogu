import { ExceptionFilter, Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';

/**
 * Filter bắt lỗi Prisma P2021 (bảng chưa tồn tại / migration chưa chạy).
 * Chỉ catch PrismaClientKnownRequestError — không nuốt BadRequest/validation.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaTableNotFoundFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaTableNotFoundFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const isTableNotFound =
      exception.code === 'P2021' ||
      exception.message?.includes('does not exist in the current database');

    if (!isTableNotFound) {
      throw exception;
    }

    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest();

    this.logger.warn(
      `Bảng DB chưa tồn tại (migration chưa chạy): ${exception.message?.split('\n')[0]}`,
    );

    const url: string = request.url ?? '';
    let emptyData: any = { data: [], pageInfo: { nextCursor: null, hasNextPage: false } };

    if (url.match(/\/[a-f0-9-]{36}(\/|$)/) && !url.includes('?')) {
      emptyData = null;
    }

    reply.status(200).send({
      success: true,
      data: emptyData,
      timestamp: new Date().toISOString(),
      _warning: 'Bảng DB chưa tồn tại — chạy migration để có dữ liệu thực.',
    });
  }
}
