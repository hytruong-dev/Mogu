import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { WsJobProgress } from './dto/import-job.dto';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';

const IMPORT_ROLES = new Set(['SUPER_ADMIN', 'CONTENT_ADMIN']);
const roomFor = (jobId: string) => `import-job:${jobId}`;

@WebSocketGateway({
  cors: {
    origin: (origin, callback) => {
      const allowed = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      if (!origin || allowed.includes(origin)) return callback(null, true);
      return callback(new Error('Origin không được phép'));
    },
    credentials: true,
  },
  namespace: '/import',
})
export class ImportGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ImportGateway.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit() {
    this.logger.log('Import WebSocket Gateway initialized at /import');
  }

  async handleConnection(client: Socket) {
    try {
      const authorization =
        client.handshake.auth?.token ??
        client.handshake.headers.authorization;
      const token = typeof authorization === 'string'
        ? authorization.replace(/^Bearer\s+/i, '')
        : '';
      if (!token) throw new Error('Thiếu JWT');

      const supabase = createClient(
        this.config.get<string>('app.supabase.url')!,
        this.config.get<string>('app.supabase.secretKey')!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) throw new Error('JWT không hợp lệ');

      const profile = await this.prisma.db.profile.findUnique({
        where: { userId: data.user.id },
        select: { profileRoles: { select: { role: true } } },
      });
      const roles = profile?.profileRoles.map(({ role }) => String(role)) ?? [];
      if (!roles.some((role) => IMPORT_ROLES.has(role))) {
        throw new Error('Không đủ quyền AI Import');
      }
      client.data.userId = data.user.id;
      client.data.roles = roles;
      this.logger.debug(`Authorized import socket: ${client.id}`);
    } catch (error) {
      this.logger.warn(`Rejected import socket ${client.id}: ${(error as Error).message}`);
      client.emit('auth:error', { code: 'UNAUTHORIZED' });
      client.disconnect(true);
    }
  }

  @SubscribeMessage('job:subscribe')
  async subscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { jobId?: string },
  ) {
    const jobId = body?.jobId;
    if (!client.data.userId || !jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) {
      return { ok: false, code: 'INVALID_SUBSCRIPTION' };
    }
    const roles = Array.isArray(client.data.roles) ? client.data.roles : [];
    if (!roles.some((role: string) => IMPORT_ROLES.has(role))) {
      return { ok: false, code: 'FORBIDDEN' };
    }
    const model = (this.prisma.db as any).importJob;
    if (!model) return { ok: false, code: 'JOB_STORE_UNAVAILABLE' };
    const job = await model.findUnique({
      where: { id: jobId },
      select: { id: true, requestedBy: true },
    });
    if (!job) return { ok: false, code: 'JOB_NOT_FOUND' };
    const isSuperAdmin = roles.includes('SUPER_ADMIN');
    if (!isSuperAdmin && job.requestedBy !== client.data.userId) {
      return { ok: false, code: 'FORBIDDEN' };
    }
    await client.join(roomFor(jobId));
    return { ok: true, room: roomFor(jobId) };
  }

  @SubscribeMessage('job:unsubscribe')
  async unsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { jobId?: string },
  ) {
    if (body?.jobId) await client.leave(roomFor(body.jobId));
    return { ok: true };
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  /** Gửi progress update đến tất cả client đang lắng nghe job này */
  emitProgress(payload: WsJobProgress) {
    this.server.to(roomFor(payload.jobId)).emit('job:progress', payload);
    this.server.to(roomFor(payload.jobId)).emit(`job:${payload.jobId}`, payload);
  }
}
