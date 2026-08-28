import { ExceptionFilter, Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { FastifyReply } from 'fastify';

/**
 * Filter bắt lỗi Prisma P2021 (bảng chưa tồn tại / migration chưa chạy)
 * Trả về 200 với data rỗng thay vì 500 để admin UI không crash.
 */
@Catch()
export class PrismaTableNotFoundFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaTableNotFoundFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const isTableNotFound =
      exception?.code === 'P2021' ||
      exception?.message?.includes('does not exist in the current database');

    if (!isTableNotFound) {
      // Không phải lỗi này → ném lại để GlobalExceptionFilter xử lý
      throw exception;
    }

    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest();

    this.logger.warn(
      `Bảng DB chưa tồn tại (migration chưa chạy): ${exception.message?.split('\n')[0]}`,
    );

    // Trả về response rỗng phù hợp với từng endpoint
    const url: string = request.url ?? '';
    let emptyData: any = { data: [], pageInfo: { nextCursor: null, hasNextPage: false } };

    // Endpoint trả object đơn → trả null
    if (url.match(/\/[a-f0-9-]{36}(\/|$)/) && !url.includes('?')) {
      emptyData = null;
    }

    reply.status(200).send({
      success: true,
      data: emptyData,
      timestamp: new Date().toISOString(),
      _warning: 'Bảng DB chưa tồn tại — chạy migration BA-004 để có dữ liệu thực.',
    });
  }
}
