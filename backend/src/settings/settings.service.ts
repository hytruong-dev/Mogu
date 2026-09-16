import {
  Injectable,
  PreconditionFailedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private format(row: any) {
    return {
      version: row.version,
      notifications: {
        pushEnabled: row.pushEnabled,
        mealReminders: row.mealReminders,
        waterReminders: row.waterReminders,
        weeklyPlanNotif: row.weeklyPlanNotif ?? true,
        communityNotif: row.communityNotif ?? true,
        marketingNotif: row.marketingNotif ?? false,
      },
      privacy: {
        shareData: row.shareData,
        analytics: row.analyticsEnabled,
        analyticsEnabled: row.analyticsEnabled,
        profileVisibility: row.profileVisibility ?? 'PUBLIC',
        showDietActivity: row.showDietActivity ?? true,
        allowComments: row.allowComments ?? true,
      },
      theme: row.appTheme,
      appTheme: row.appTheme,
      language: row.language,
    };
  }

  async getOrCreate(userId: string) {
    const existing = await this.prisma.db.userSetting.findUnique({
      where: { userId },
    });
    if (existing) return existing;

    return this.prisma.db.userSetting.create({
      data: { userId },
    });
  }

  async getSettings(userId: string) {
    const row = await this.getOrCreate(userId);
    return this.format(row);
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

    const cleanVer = ifMatch.replace(/"/g, '').trim();
    const expectedVer = parseInt(cleanVer, 10);
    const current = await this.getOrCreate(userId);

    if (isNaN(expectedVer) || current.version !== expectedVer) {
      throw new PreconditionFailedException({
        error: {
          code: 'SETTINGS_VERSION_CONFLICT',
          message: 'Cài đặt đã được cập nhật ở nơi khác.',
          details: { expectedVersion: current.version },
        },
      });
    }

    const theme = dto.theme ?? dto.appTheme;

    const updated = await this.prisma.db.userSetting.update({
      where: { userId },
      data: {
        ...(dto.pushNotificationsEnabled !== undefined
          ? { pushEnabled: dto.pushNotificationsEnabled }
          : {}),
        ...(dto.mealRemindersEnabled !== undefined
          ? { mealReminders: dto.mealRemindersEnabled }
          : {}),
        ...(dto.waterRemindersEnabled !== undefined
          ? { waterReminders: dto.waterRemindersEnabled }
          : {}),
        ...(dto.weeklyPlanNotif !== undefined
          ? { weeklyPlanNotif: dto.weeklyPlanNotif }
          : {}),
        ...(dto.communityNotif !== undefined
          ? { communityNotif: dto.communityNotif }
          : {}),
        ...(dto.marketingNotif !== undefined
          ? { marketingNotif: dto.marketingNotif }
          : {}),
        ...(dto.shareData !== undefined ? { shareData: dto.shareData } : {}),
        ...(dto.analyticsEnabled !== undefined
          ? { analyticsEnabled: dto.analyticsEnabled }
          : {}),
        ...(dto.profileVisibility !== undefined
          ? { profileVisibility: dto.profileVisibility }
          : {}),
        ...(dto.showDietActivity !== undefined
          ? { showDietActivity: dto.showDietActivity }
          : {}),
        ...(dto.allowComments !== undefined
          ? { allowComments: dto.allowComments }
          : {}),
        ...(theme ? { appTheme: theme } : {}),
        ...(dto.language ? { language: dto.language } : {}),
        version: { increment: 1 },
      },
    });

    return this.format(updated);
  }
}
