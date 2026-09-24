import { ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { ExpoPushService } from './expo-push.service';
import {
  NotificationDto,
  NotificationListResponseDto,
  NotificationQueryDto,
  RegisterPushInstallationDto,
  UnreadCountResponseDto,
} from './dto/notification.dto';

const DEEP_LINK_ALLOWLIST = [
  /^mogu:\/\/home$/,
  /^mogu:\/\/dishes\/[0-9a-f-]+$/i,
  /^mogu:\/\/weekly-plans?(\/[0-9a-f-]+)?$/i,
  /^mogu:\/\/health$/,
  /^mogu:\/\/notifications$/,
  /^mogu:\/\/community\/posts\/[0-9a-f-]+$/i,
  /^mogu:\/\/explore\/articles\/[0-9a-f-]+$/i,
  /^mogu:\/\/users\/[0-9a-f-]+$/i,
  /^mogu:\/\/profile(\/[a-z0-9_-]+)*$/i,
  /^\/dishes\/[0-9a-f-]+$/i,
  /^\/weekly-plans?(\/[0-9a-f-]+)?$/i,
  /^\/health/,
  /^\/notifications$/,
  /^\/community\/posts\/[0-9a-f-]+$/i,
  /^\/explore\/articles\/[0-9a-f-]+$/i,
  /^\/users\/[0-9a-f-]+$/i,
  /^\/profile(\/[a-z0-9_-]+)*$/i,
];

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly expoPushService: ExpoPushService,
    @Optional() private readonly notificationsGateway?: NotificationsGateway,
  ) {}

  isAllowedDeepLink(deepLink?: string | null): boolean {
    if (!deepLink) return true;
    return DEEP_LINK_ALLOWLIST.some((re) => re.test(deepLink));
  }

  async getUnreadCount(userId: string): Promise<UnreadCountResponseDto> {
    const count = await this.prisma.db.notification.count({
      where: { userId, status: 'UNREAD' },
    });
    return { count };
  }

  async getNotifications(
    userId: string,
    query: NotificationQueryDto,
  ): Promise<NotificationListResponseDto> {
    const limit = query.limit ?? 20;

    const items = await this.prisma.db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(query.cursor
        ? { cursor: { id: query.cursor }, skip: 1 }
        : query.page && query.page > 1
          ? { skip: (query.page - 1) * limit }
          : {}),
    });

    const hasMore = items.length > limit;
    const data = items.slice(0, limit).map((n) => this.mapToDto(n));
    const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null;

    return {
      data,
      items: data,
      page: query.page ?? 1,
      limit,
      hasMore,
      nextCursor,
      pageInfo: { nextCursor, hasMore },
    };
  }

  async markAsRead(userId: string, notificationId: string): Promise<NotificationDto> {
    const notif = await this.prisma.db.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notif) {
      throw new NotFoundException('Thông báo không tồn tại.');
    }
    if (notif.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên thông báo này.');
    }
    if (notif.status === 'READ') {
      return this.mapToDto(notif);
    }

    const updated = await this.prisma.db.notification.update({
      where: { id: notificationId },
      data: { status: 'READ', readAt: new Date() },
    });
    const dto = this.mapToDto(updated);
    this.prisma.db.notification.count({ where: { userId, status: 'UNREAD' } })
      .then((c) => this.notificationsGateway?.emitUnreadCount(userId, c))
      .catch(() => null);
    return dto;
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.db.notification.updateMany({
      where: { userId, status: 'UNREAD' },
      data: { status: 'READ', readAt: new Date() },
    });
    this.notificationsGateway?.emitUnreadCount(userId, 0);
    return { updated: result.count };
  }

  async registerPushInstallation(userId: string, dto: RegisterPushInstallationDto) {
    const row = await (this.prisma.db as any).pushInstallation.upsert({
      where: { userId_token: { userId, token: dto.token } },
      create: {
        userId,
        token: dto.token,
        platform: dto.platform,
        appVersion: dto.appVersion ?? null,
      },
      update: {
        platform: dto.platform,
        appVersion: dto.appVersion ?? null,
        invalidatedAt: null,
      },
    });
    return {
      id: row.id,
      platform: row.platform,
      appVersion: row.appVersion,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async unregisterPushInstallation(userId: string, id: string) {
    await (this.prisma.db as any).pushInstallation.updateMany({
      where: { id, userId },
      data: { invalidatedAt: new Date() },
    });
    return { success: true };
  }

  /** Create in-app notification + optional push outbox (no-op adapter if no FCM keys) */
  async enqueueInAppNotification(params: {
    userId: string;
    type: string;
    title: string;
    body: string;
    deepLink?: string;
  }) {
    if (!this.isAllowedDeepLink(params.deepLink)) {
      this.logger.warn(`Blocked deepLink: ${params.deepLink}`);
      params.deepLink = undefined;
    }

    const notif = await this.prisma.db.notification.create({
      data: {
        userId: params.userId,
        type: params.type as any,
        title: params.title,
        body: params.body,
        deepLink: params.deepLink ?? null,
      },
    });

    const dto = this.mapToDto(notif);

    // Emit realtime WebSocket notification event
    try {
      this.notificationsGateway?.emitToUsers([params.userId], dto);
      this.prisma.db.notification
        .count({ where: { userId: params.userId, status: 'UNREAD' } })
        .then((c) => this.notificationsGateway?.emitUnreadCount(params.userId, c))
        .catch(() => null);
    } catch {
      // Non-fatal
    }

    // Send real push notification if user notification settings permit
    try {
      const userSetting = await this.prisma.db.userSetting.findUnique({
        where: { userId: params.userId },
      });

      const isPushEnabled = userSetting ? userSetting.pushEnabled : true;
      if (isPushEnabled) {
        let canSendPush = true;
        const type = params.type;

        if (type.startsWith('SOCIAL_')) {
          canSendPush = userSetting ? userSetting.communityNotif : true;
        } else if (type === 'PROMO') {
          canSendPush = userSetting ? userSetting.marketingNotif : false;
        } else if (type === 'REMINDER') {
          canSendPush = userSetting ? userSetting.weeklyPlanNotif : true;
        }

        if (canSendPush) {
          void this.expoPushService
            .sendToUsers([params.userId], {
              title: params.title,
              body: params.body,
              sound: 'default',
              data: {
                notificationId: notif.id,
                deepLink: params.deepLink ?? null,
                type: params.type,
              },
            })
            .catch((err) => {
              this.logger.warn(
                `Failed to send push notification for user=${params.userId}: ${err.message}`,
              );
            });
        }
      }
    } catch (pushErr: any) {
      this.logger.warn(`Error checking settings or sending push: ${pushErr.message}`);
    }

    return dto;
  }

  private mapToDto(n: {
    id: string;
    type: string;
    title: string;
    body: string;
    deepLink: string | null;
    imageUrl: string | null;
    status: string;
    readAt: Date | null;
    createdAt: Date;
  }): NotificationDto {
    return {
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      deepLink: n.deepLink ?? undefined,
      imageUrl: n.imageUrl ?? undefined,
      status: n.status,
      readAt: n.readAt?.toISOString(),
      createdAt: n.createdAt.toISOString(),
    };
  }
}
