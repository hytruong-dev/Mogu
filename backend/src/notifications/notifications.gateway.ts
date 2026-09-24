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
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit() {
    this.logger.log('Notifications WebSocket Gateway initialized at /notifications');
  }

  async handleConnection(client: Socket) {
    try {
      const authorization =
        client.handshake.auth?.token ??
        client.handshake.headers.authorization ??
        client.handshake.query?.token;

      let userId: string | null =
        (client.handshake.auth?.userId as string) ??
        (client.handshake.query?.userId as string) ??
        null;

      const token = typeof authorization === 'string'
        ? authorization.replace(/^Bearer\s+/i, '')
        : '';

      if (token) {
        try {
          const supabaseUrl =
            this.config.get<string>('app.supabase.url') || process.env.SUPABASE_URL;
          const secretKey =
            this.config.get<string>('app.supabase.secretKey') ||
            process.env.SUPABASE_SECRET_KEY ||
            process.env.SUPABASE_SERVICE_ROLE_KEY;

          if (supabaseUrl && secretKey) {
            const supabase = createClient(supabaseUrl, secretKey, {
              auth: { persistSession: false, autoRefreshToken: false },
            });
            const { data } = await supabase.auth.getUser(token);
            if (data?.user?.id) {
              userId = data.user.id;
            }
          }
        } catch (e: any) {
          this.logger.debug(`Could not verify JWT with Supabase: ${e.message}`);
        }
      }

      // Always join public broadcast room
      client.join('broadcast:all');

      if (userId) {
        client.data.userId = userId;
        client.join(`user:${userId}`);
        this.logger.log(`Client ${client.id} joined notification room user:${userId}`);
      } else {
        this.logger.log(`Client ${client.id} joined broadcast:all (anonymous / pending auth)`);
      }

      client.emit('connected', {
        status: 'OK',
        userId: userId ?? null,
        timestamp: Date.now(),
      });
    } catch (err: any) {
      this.logger.warn(`Error on notification socket connection ${client.id}: ${err.message}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Notification socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('auth')
  async handleAuth(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { token?: string; userId?: string },
  ) {
    let resolvedUserId = payload?.userId ?? null;

    if (payload?.token) {
      try {
        const token = payload.token.replace(/^Bearer\s+/i, '');
        const supabaseUrl =
          this.config.get<string>('app.supabase.url') || process.env.SUPABASE_URL;
        const secretKey =
          this.config.get<string>('app.supabase.secretKey') ||
          process.env.SUPABASE_SECRET_KEY ||
          process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (supabaseUrl && secretKey) {
          const supabase = createClient(supabaseUrl, secretKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data } = await supabase.auth.getUser(token);
          if (data?.user?.id) {
            resolvedUserId = data.user.id;
          }
        }
      } catch (err: any) {
        this.logger.warn(`Auth message error: ${err.message}`);
      }
    }

    if (resolvedUserId) {
      // Leave old user room if any
      if (client.data.userId) {
        client.leave(`user:${client.data.userId}`);
      }
      client.data.userId = resolvedUserId;
      client.join(`user:${resolvedUserId}`);
      this.logger.log(`Client ${client.id} authenticated for user:${resolvedUserId}`);
      client.emit('auth:success', { userId: resolvedUserId });
    } else {
      client.emit('auth:error', { message: 'Xác thực thất bại' });
    }
  }

  /**
   * Phát thông báo realtime tới danh sách user
   */
  emitToUsers(userIds: string[], notification: any) {
    if (!this.server || !userIds.length) return;
    for (const uid of userIds) {
      this.server.to(`user:${uid}`).emit('notification:new', notification);
    }
    this.logger.log(`Emitted notification:new to ${userIds.length} users`);
  }

  /**
   * Phát thông báo realtime tới toàn bộ user (broadcast)
   */
  emitBroadcast(notification: any) {
    if (!this.server) return;
    this.server.to('broadcast:all').emit('notification:new', notification);
    this.logger.log(`Emitted broadcast notification:new to broadcast:all`);
  }

  /**
   * Gửi unread count cập nhật
   */
  emitUnreadCount(userId: string, count: number) {
    if (!this.server) return;
    this.server.to(`user:${userId}`).emit('notification:unread_count', { count });
  }
}
