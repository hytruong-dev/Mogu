import {
  Injectable,
  PreconditionFailedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) { }

  async getSettings(userId: string) {
    const profile = await this.prisma.db.profile.findUnique({
      where: { userId },
      select: { profileVersion: true },
    });

    return {
      version: profile?.profileVersion ?? 1,
      notifications: {
        pushEnabled: true,
        mealReminders: true,
        waterReminders: true,
      },
      privacy: {
        shareData: false,
        analytics: true,
      },
      appTheme: 'system',
      language: 'vi',
    };
  }

  async updateSettings(
    userId: string,
    dto: UpdateSettingsDto,
    ifMatch?: string,
  ) {
    if (!ifMatch) {
      throw new PreconditionFailedException({
        error: {
          code: 'PRECONDITION_REQUIRED',
          message: 'Thiếu header If-Match.',
        },
      });
    }

    const current = await this.getSettings(userId);
    return {
      ...current,
      notifications: {
        pushEnabled: dto.pushNotificationsEnabled ?? current.notifications.pushEnabled,
        mealReminders: dto.mealRemindersEnabled ?? current.notifications.mealReminders,
        waterReminders: dto.waterRemindersEnabled ?? current.notifications.waterReminders,
      },
      appTheme: dto.theme ?? current.appTheme,
      language: dto.language ?? current.language,
      message: 'Cài đặt đã được cập nhật.',
    };
  }
}
