import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotificationDto,
  NotificationListResponseDto,
  NotificationQueryDto,
  UnreadCountResponseDto,
} from './dto/notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /notifications/unread-count */
  async getUnreadCount(userId: string): Promise<UnreadCountResponseDto> {
    const count = await this.prisma.db.notification.count({
      where: { userId, status: 'UNREAD' },
    });
    return { count }; // HOME-BR-013: client tự hiển thị "99+" nếu count > 99
  }

  /** GET /notifications */
  async getNotifications(
    userId: string,
    query: NotificationQueryDto,
  ): Promise<NotificationListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const items = await this.prisma.db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      skip,
    });

    const hasMore = items.length > limit;
    const data = items.slice(0, limit);

    return {
      data: data.map((n) => this.mapToDto(n)),
      page,
      limit,
      hasMore,
    };
  }

  /** PATCH /notifications/:id/read */
  async markAsRead(userId: string, notificationId: string): Promise<NotificationDto> {
    const notif = await this.prisma.db.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notif) {
      throw new NotFoundException('Thông báo không tồn tại.');
    }

    // Validate ownership — không cho đọc thông báo của người khác
    if (notif.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên thông báo này.');
    }

    if (notif.status === 'READ') {
      return this.mapToDto(notif); // Idempotent — đã đọc rồi thì không update
    }

    const updated = await this.prisma.db.notification.update({
      where: { id: notificationId },
      data: { status: 'READ', readAt: new Date() },
    });

    return this.mapToDto(updated);
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

