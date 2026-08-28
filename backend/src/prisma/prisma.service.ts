import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  readonly client: PrismaClient;

  constructor() {
    const connectionString =
      process.env.DATABASE_URL ??
      (() => {
        throw new Error('DATABASE_URL env variable is not set');
      })();

    const adapter = new PrismaPg({ connectionString });

    this.client = new PrismaClient({
      adapter,
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'warn', 'error']
          : ['warn', 'error'],
    });
  }

  async onModuleInit() {
    await this.client.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
    this.logger.log('Database disconnected');
  }

  /** Shortcut dùng trong các service */
  get db() {
    return this.client;
  }

  /** Chỉ dùng trong test environment */
  async cleanDatabase() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('cleanDatabase() chỉ dùng trong môi trường test');
    }
    const tables = await this.client.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename != '_prisma_migrations'
    `;
    for (const { tablename } of tables) {
      await this.client.$executeRawUnsafe(
        `TRUNCATE TABLE "${tablename}" CASCADE`,
      );
    }
  }
}
