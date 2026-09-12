import { NestFactory, Reflector } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe, VersioningType, BadRequestException } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaTableNotFoundFilter } from './common/filters/prisma-table-not-found.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { formatValidationErrors } from './common/utils/validation-error.util';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
    { bufferLogs: true },
  );

  // ── Logger (Pino) ──────────────────────────────────────────────────────────
  app.useLogger(app.get(Logger));

  // ── x-trace-id & X-Request-Id header ─────────────────────────────────────
  const fastifyInstance = app.getHttpAdapter().getInstance();
  fastifyInstance.addHook('onRequest', async (request: any, reply: any) => {
    const requestId =
      request.headers['x-request-id'] ??
      request.headers['x-correlation-id'] ??
      crypto.randomUUID();
    request.traceId = requestId;
    reply.header('x-trace-id', requestId);
    reply.header('X-Request-Id', requestId);
  });

  // ── WebSocket (socket.io) ──────────────────────────────────────────────────
  app.useWebSocketAdapter(new IoAdapter(app));

  // ── Global Exception Filter ────────────────────────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter(), new PrismaTableNotFoundFilter());

  // ── Global Response Interceptor ────────────────────────────────────────────
  app.useGlobalInterceptors(new TransformInterceptor());

  // ── Global JWT Guard ───────────────────────────────────────────────────────
  const reflector = app.get(Reflector);
  const configService = app.get(ConfigService);
  app.useGlobalGuards(new JwtAuthGuard(reflector, configService));

  // ── Global Validation Pipe ─────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) => {
        const details = formatValidationErrors(errors);
        const summary =
          details.map((d) => `${d.field}: ${d.message}`).join('; ') ||
          'Dữ liệu không hợp lệ';
        return new BadRequestException({
          error: {
            code: 'VALIDATION_FAILED',
            message: summary,
            details,
          },
        });
      },
    }),
  );

  // ── API Versioning ─────────────────────────────────────────────────────────
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // ── CORS ──────────────────────────────────────────────────────────────────
  const corsOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean);
  app.enableCors({
    origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'If-Match',
      'Idempotency-Key',
      'x-idempotency-key',
      'x-profile-version',
      'x-platform',
      'x-app-version',
      'x-correlation-id',
      'x-request-id',
      'x-timezone',
      'x-local-date',
    ],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['x-profile-version', 'x-trace-id', 'X-Request-Id'],
  });

  // ── Swagger / OpenAPI ──────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Mogu API')
      .setDescription('Mogu backend REST API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/docs/json',
    });
  }

  // ── Start ──────────────────────────────────────────────────────────────────
  const port = process.env.PORT ?? 3001;
  console.log(`[bootstrap] Listening on port ${port}...`);
  await app.listen(port, '0.0.0.0');
  console.log(`[bootstrap] Application is running on: ${await app.getUrl()}`);
}

bootstrap().catch(err => {
  console.error('[bootstrap] Fatal error:', err);
  process.exit(1);
});
