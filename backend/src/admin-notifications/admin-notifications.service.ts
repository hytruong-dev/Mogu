import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { ExpoPushService } from '../notifications/expo-push.service';
import {
  BroadcastNotificationDto,
  BroadcastScope,
  BroadcastType,
} from './dto/broadcast-notification.dto';

@Injectable()
export class AdminNotificationsService {
  private readonly logger = new Logger(AdminNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly expoPushService: ExpoPushService,
    @Optional() private readonly notificationsGateway?: NotificationsGateway,
  ) {}

  async broadcast(actorUserId: string, dto: BroadcastNotificationDto) {
    if (dto.deepLink && !this.notificationsService.isAllowedDeepLink(dto.deepLink)) {
      throw new BadRequestException('Deep link không hợp lệ theo allowlist ứng dụng.');
    }

    let recipientIds: string[] = [];

    if (dto.scope === BroadcastScope.SPECIFIC_USER) {
      if (!dto.targetUser?.trim()) {
        throw new BadRequestException('Vui lòng cung cấp username hoặc userId người nhận.');
      }
      const rawTarget = dto.targetUser.trim();
      const isUuid = /^[0-9a-fA-F-]{36}$/.test(rawTarget);

      const account = await this.prisma.db.account.findFirst({
        where: {
          OR: [
            { username: rawTarget },
            ...(isUuid ? [{ id: rawTarget }, { userId: rawTarget }] : []),
          ],
        },
        select: { id: true, userId: true },
      });

      if (account?.userId) {
        recipientIds = [account.userId];
      } else {
        const profile = await this.prisma.db.profile.findFirst({
          where: {
            OR: [
              { displayName: rawTarget },
              ...(isUuid ? [{ userId: rawTarget }, { id: rawTarget }] : []),
            ],
          },
          select: { userId: true },
        });

        if (!profile) {
          throw new NotFoundException(`Không tìm thấy người dùng "${rawTarget}".`);
        }
        recipientIds = [profile.userId];
      }
    } else {
      // Broadcast to ALL non-deleted users
      const profiles = await this.prisma.db.profile.findMany({
        where: {
          accountStatus: { not: 'DELETED' },
        },
        select: { userId: true },
      });
      recipientIds = profiles.map((p) => p.userId);
    }

    if (recipientIds.length === 0) {
      return {
        success: true,
        totalRecipients: 0,
        pushSentCount: 0,
        pushFailedCount: 0,
        message: 'Không có người dùng hợp lệ để gửi thông báo.',
      };
    }

    // 1. Batch insert in-app notifications
    const notifType = (dto.type ?? BroadcastType.SYSTEM) as any;
    const now = new Date();
    const batchSize = 200;

    for (let i = 0; i < recipientIds.length; i += batchSize) {
      const chunk = recipientIds.slice(i, i + batchSize);
      await this.prisma.db.notification.createMany({
        data: chunk.map((uid) => ({
          userId: uid,
          type: notifType,
          title: dto.title,
          body: dto.body,
          deepLink: dto.deepLink || null,
          createdAt: now,
        })),
      });
    }

    // Realtime WebSocket broadcast/emit
    try {
      const realtimePayload = {
        id: randomUUID(),
        type: notifType,
        title: dto.title,
        body: dto.body,
        deepLink: dto.deepLink || null,
        status: 'UNREAD',
        createdAt: now.toISOString(),
      };

      if (dto.scope === BroadcastScope.ALL) {
        this.notificationsGateway?.emitBroadcast(realtimePayload);
      } else {
        this.notificationsGateway?.emitToUsers(recipientIds, realtimePayload);
      }

      // Update unread count for recipients
      for (const uid of recipientIds.slice(0, 200)) {
        this.prisma.db.notification.count({ where: { userId: uid, status: 'UNREAD' } })
          .then((count) => this.notificationsGateway?.emitUnreadCount(uid, count))
          .catch(() => null);
      }
    } catch (wsErr: any) {
      this.logger.warn(`Failed to emit realtime notification: ${wsErr.message}`);
    }

    // 2. Send active push notifications via ExpoPushService
    const pushResult = await this.expoPushService.sendToUsers(recipientIds, {
      title: dto.title,
      body: dto.body,
      sound: 'default',
      data: {
        deepLink: dto.deepLink ?? null,
        type: dto.type ?? 'SYSTEM',
      },
    });
    const pushSentCount = pushResult.sent;
    const pushFailedCount = pushResult.failed;
    const pushTokensTargeted = pushResult.targeted;

    // 3. Write admin action audit for broadcast history
    await (this.prisma.db as any).adminActionAudit.create({
      data: {
        actorUserId,
        targetType: 'BROADCAST',
        targetId: randomUUID(),
        action: 'NOTIFICATION_BROADCAST',
        reasonCode: dto.type ?? 'SYSTEM',
        result: 'SUCCESS',
        afterSanitized: {
          title: dto.title,
          body: dto.body,
          type: dto.type ?? 'SYSTEM',
          scope: dto.scope ?? 'ALL',
          targetUser: dto.targetUser ?? null,
          deepLink: dto.deepLink ?? null,
          totalRecipients: recipientIds.length,
          pushTokensTargeted,
          pushSentCount,
          pushFailedCount,
        },
      },
    });

    return {
      success: true,
      totalRecipients: recipientIds.length,
      pushTokensTargeted,
      pushSentCount,
      pushFailedCount,
    };
  }

  async getHistory(limit = 20, offset = 0) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = Math.max(offset, 0);

    const [items, total] = await Promise.all([
      (this.prisma.db as any).adminActionAudit.findMany({
        where: { targetType: 'BROADCAST' },
        orderBy: { occurredAt: 'desc' },
        take,
        skip,
      }),
      (this.prisma.db as any).adminActionAudit.count({
        where: { targetType: 'BROADCAST' },
      }),
    ]);

    // Lookup actor details
    const actorUserIds = [...new Set(items.map((it: any) => it.actorUserId))] as string[];
    const actors = await this.prisma.db.profile.findMany({
      where: { userId: { in: actorUserIds } },
      select: { userId: true, displayName: true, avatarUrl: true },
    });
    const actorMap = new Map(actors.map((a) => [a.userId, a]));

    const formatted = items.map((it: any) => {
      const payload = it.afterSanitized ?? {};
      const actor = actorMap.get(it.actorUserId);
      return {
        id: it.id,
        occurredAt: it.occurredAt.toISOString(),
        actor: {
          id: it.actorUserId,
          displayName: actor?.displayName ?? 'Quản trị viên',
          avatarUrl: actor?.avatarUrl ?? null,
        },
        title: payload.title ?? '',
        body: payload.body ?? '',
        type: payload.type ?? 'SYSTEM',
        scope: payload.scope ?? 'ALL',
        targetUser: payload.targetUser ?? null,
        deepLink: payload.deepLink ?? null,
        totalRecipients: payload.totalRecipients ?? 0,
        pushSentCount: payload.pushSentCount ?? 0,
        pushFailedCount: payload.pushFailedCount ?? 0,
      };
    });

    return {
      items: formatted,
      total,
      hasMore: skip + items.length < total,
    };
  }
}
