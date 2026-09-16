import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  PreconditionFailedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateBasicDto } from './dto/update-basic.dto';
import { UpdateHealthDto } from './dto/update-health.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);
  private readonly supabase: SupabaseClient | null;
  private readonly avatarBucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.avatarBucket =
      this.config.get<string>('SUPABASE_AVATAR_BUCKET') ??
      this.config.get<string>('SUPABASE_STORAGE_BUCKET') ??
      'dish-images';
    this.supabase =
      supabaseUrl && serviceRoleKey
        ? createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : null;
  }

  private async getProfileOrThrow(userId: string) {
    const profile = await this.prisma.db.profile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException({ code: 'PROFILE_NOT_FOUND', message: 'Không tìm thấy profile.' });
    }
    return profile;
  }

  private validateVersion(profileVersionHeader: string | undefined, currentVersion: number) {
    if (!profileVersionHeader) {
      throw new PreconditionFailedException({
        error: {
          code: 'PRECONDITION_REQUIRED',
          message: 'Thiếu header If-Match hoặc x-profile-version.',
        },
      });
    }

    const cleanVer = profileVersionHeader.replace(/"/g, '').trim();
    const parsedVer = parseInt(cleanVer, 10);

    if (isNaN(parsedVer) || parsedVer !== currentVersion) {
      throw new PreconditionFailedException({
        type: 'https://api.mogu.vn/problems/profile-version-conflict',
        title: 'Profile version conflict',
        status: 412,
        code: 'PROFILE_VERSION_CONFLICT',
        detail: 'Hồ sơ đã được cập nhật trên thiết bị khác.',
        currentVersion,
      });
    }
  }

  private normalizeUsername(username: string): string {
    return username.trim().toLowerCase().replace(/^@+/, '');
  }

  async updateBasic(
    userId: string,
    dto: UpdateBasicDto,
    profileVersionHeader?: string,
  ) {
    const profile = await this.getProfileOrThrow(userId);
    this.validateVersion(profileVersionHeader, profile.profileVersion);

    const updateData: Record<string, unknown> = {};

    if (dto.displayName !== undefined) {
      updateData.displayName = dto.displayName;
    }
    if (dto.gender !== undefined) {
      updateData.gender = dto.gender;
    }
    if (dto.bio !== undefined) {
      updateData.bio = dto.bio;
    }
    if (dto.regionId !== undefined) {
      if (dto.regionId) {
        const region = await this.prisma.db.region.findFirst({
          where: { id: dto.regionId, isActive: true },
        });
        if (!region) {
          throw new BadRequestException({
            error: {
              code: 'VALIDATION_FAILED',
              message: 'Khu vực không hợp lệ.',
              details: { field: 'regionId' },
            },
          });
        }
      }
      updateData.regionId = dto.regionId;
    }
    if (dto.dateOfBirth !== undefined) {
      if (dto.dateOfBirth !== null) {
        const dob = new Date(dto.dateOfBirth);
        if (dob >= new Date()) {
          throw new BadRequestException({
            error: {
              code: 'VALIDATION_FAILED',
              message: 'Ngày sinh chưa hợp lệ. Vui lòng kiểm tra lại.',
              details: { field: 'dateOfBirth' },
            },
          });
        }
        updateData.dateOfBirth = dob;
      } else {
        updateData.dateOfBirth = null;
      }
    }

    let username: string | undefined;
    let usernameNormalized: string | undefined;
    if (dto.username !== undefined) {
      username = this.normalizeUsername(dto.username);
      usernameNormalized = username;
      const taken = await this.prisma.db.account.findFirst({
        where: {
          OR: [
            { usernameNormalized },
            { username },
          ],
          NOT: {
            OR: [{ userId }, { passwordHash: userId }],
          },
        },
      });
      if (taken) {
        throw new ConflictException({
          code: 'USERNAME_TAKEN',
          message: 'Tên người dùng đã được sử dụng.',
          errors: [{ pointer: '#/username', code: 'USERNAME_TAKEN' }],
        });
      }
    }

    const expectedVersion = profile.profileVersion;
    const result = await this.prisma.db.$transaction(async (tx) => {
      if (username) {
        const account = await tx.account.findFirst({
          where: { OR: [{ userId }, { passwordHash: userId }] },
        });
        if (account) {
          await tx.account.update({
            where: { id: account.id },
            data: {
              username,
              usernameNormalized,
              userId: account.userId ?? userId,
            },
          });
        } else {
          await tx.account.create({
            data: {
              userId,
              username,
              usernameNormalized,
              passwordHash: userId,
            },
          });
        }
      }

      const updated = await tx.profile.updateMany({
        where: { userId, profileVersion: expectedVersion },
        data: {
          ...updateData,
          profileVersion: { increment: 1 },
        },
      });
      if (updated.count === 0) {
        throw new PreconditionFailedException({
          code: 'PROFILE_VERSION_CONFLICT',
          detail: 'Hồ sơ đã được cập nhật trên thiết bị khác.',
          currentVersion: expectedVersion,
        });
      }

      return tx.profile.findUnique({
        where: { userId },
        select: {
          displayName: true,
          gender: true,
          dateOfBirth: true,
          bio: true,
          regionId: true,
          profileVersion: true,
          updatedAt: true,
        },
      });
    });

    return {
      ...result,
      username: username ?? (await this.resolveUsername(userId)),
      message: 'Thông tin cơ bản đã được cập nhật.',
    };
  }

  async updateHealth(
    userId: string,
    dto: UpdateHealthDto,
    profileVersionHeader?: string,
  ) {
    const profile = await this.getProfileOrThrow(userId);
    this.validateVersion(profileVersionHeader, profile.profileVersion);

    const updated = await this.prisma.db.profile.update({
      where: { userId },
      data: {
        heightCm: dto.heightCm !== undefined ? dto.heightCm : profile.heightCm,
        weightKg: dto.weightKg !== undefined ? dto.weightKg : profile.weightKg,
        profileVersion: profile.profileVersion + 1,
      },
      select: {
        heightCm: true,
        weightKg: true,
        profileVersion: true,
        updatedAt: true,
      },
    });

    return { ...updated, message: 'Thông số sức khỏe đã được cập nhật.' };
  }

  async updatePreferences(
    userId: string,
    dto: UpdatePreferencesDto,
    profileVersionHeader?: string,
  ) {
    const profile = await this.getProfileOrThrow(userId);
    this.validateVersion(profileVersionHeader, profile.profileVersion);

    if (dto.noAllergies && dto.allergenIds && dto.allergenIds.length > 0) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Hãy kiểm tra lại thông tin dị ứng.',
          details: { field: 'allergenIds' },
        },
      });
    }

    if (dto.primaryGoalId !== undefined) {
      const primaryGoal = await this.prisma.db.goal.findUnique({
        where: { id: dto.primaryGoalId },
      });
      if (!primaryGoal || !primaryGoal.active) {
        throw new BadRequestException({
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Một lựa chọn không còn khả dụng.',
            details: { field: 'primaryGoalId' },
          },
        });
      }

      const secondaryIds = dto.secondaryGoalIds ?? [];
      if (secondaryIds.includes(dto.primaryGoalId)) {
        throw new BadRequestException({
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Mục tiêu phụ không được trùng với mục tiêu chính.',
            details: { field: 'secondaryGoalIds' },
          },
        });
      }

      await this.prisma.db.userGoal.deleteMany({ where: { userId } });
      await this.prisma.db.userGoal.create({
        data: { userId, goalId: dto.primaryGoalId, priority: 'PRIMARY' },
      });
      for (const id of secondaryIds) {
        const goal = await this.prisma.db.goal.findUnique({ where: { id } });
        if (goal?.active) {
          await this.prisma.db.userGoal.create({
            data: { userId, goalId: id, priority: 'SECONDARY' },
          });
        }
      }
    }

    if (dto.dietaryPreferenceIds !== undefined) {
      await this.prisma.db.userDietaryPreference.deleteMany({ where: { userId } });
      for (const prefId of dto.dietaryPreferenceIds) {
        const pref = await this.prisma.db.dietaryPreference.findUnique({ where: { id: prefId } });
        if (pref?.active) {
          await this.prisma.db.userDietaryPreference.create({
            data: { userId, preferenceId: prefId },
          });
        }
      }
    }

    if (dto.allergenIds !== undefined || dto.noAllergies !== undefined) {
      await this.prisma.db.profile.update({
        where: { userId },
        data: { noAllergies: dto.noAllergies ?? false },
      });
      await this.prisma.db.userAllergen.deleteMany({ where: { userId } });
      if (!dto.noAllergies) {
        for (const allergenId of dto.allergenIds ?? []) {
          const allergen = await this.prisma.db.allergen.findUnique({ where: { id: allergenId } });
          if (allergen?.active) {
            await this.prisma.db.userAllergen.create({
              data: { userId, allergenId, confirmedAt: new Date() },
            });
          }
        }
      }
    }

    if (dto.avoidIngredients !== undefined) {
      await this.prisma.db.userAvoidedIngredient.deleteMany({ where: { userId } });
      for (const name of dto.avoidIngredients) {
        const trimmed = name.trim();
        if (trimmed) {
          await this.prisma.db.userAvoidedIngredient.create({
            data: { userId, ingredientName: trimmed },
          });
        }
      }
    }

    const updated = await this.prisma.db.profile.update({
      where: { userId },
      data: { profileVersion: profile.profileVersion + 1 },
      select: { profileVersion: true, updatedAt: true },
    });

    return {
      ...updated,
      message: 'Sở thích và mục tiêu đã được cập nhật.',
    };
  }

  private async resolveUsername(userId: string): Promise<string | null> {
    const byUserId = await this.prisma.db.account.findFirst({
      where: { userId },
      select: { username: true },
    });
    if (byUserId?.username) return byUserId.username;
    const byHash = await this.prisma.db.account.findFirst({
      where: { passwordHash: userId },
      select: { username: true },
    });
    return byHash?.username ?? null;
  }

  private formatLocalDate(d: Date | string): string {
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    return String(d).slice(0, 10);
  }

  private addDaysIso(isoDate: string, delta: number): string {
    const d = new Date(`${isoDate}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
  }

  private monthBounds(localDate: string, timezone: string) {
    const [y, m] = localDate.slice(0, 7).split('-').map(Number);
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const nextM = m === 12 ? 1 : m + 1;
    const nextY = m === 12 ? y + 1 : y;
    const endExclusive = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
    return { start, endExclusive, timezone };
  }

  private async computeStreak(userId: string, todayStr: string) {
    const mealDates = await this.prisma.db.diaryMealLog
      .findMany({
        where: { userId, deletedAt: null },
        select: { localDate: true },
        distinct: ['localDate'],
        orderBy: { localDate: 'desc' },
        take: 400,
      })
      .catch(() => [] as Array<{ localDate: Date }>);

    const dateSet = new Set(mealDates.map((d) => this.formatLocalDate(d.localDate)));
    let currentStreakDays = 0;
    let cursor = todayStr;
    if (!dateSet.has(cursor)) {
      cursor = this.addDaysIso(cursor, -1);
    }
    while (dateSet.has(cursor)) {
      currentStreakDays += 1;
      cursor = this.addDaysIso(cursor, -1);
    }
    return { currentStreakDays, dateSet };
  }

  async getProfileDashboard(
    userId: string,
    query: { localDate?: string; timezone?: string; weekStartsOn?: string },
  ) {
    const profile = await this.getProfileOrThrow(userId);
    const timezone = query.timezone ?? profile.timezone ?? 'Asia/Ho_Chi_Minh';
    const localDate =
      query.localDate ??
      new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
    const { start: monthStart, endExclusive: monthEnd } = this.monthBounds(localDate, timezone);

    const [
      username,
      primaryGoal,
      publishedPostCount,
      savedDishCount,
      followerCount,
      randomRuns,
      mealsThisMonth,
      unreadNotifications,
      streakInfo,
      distinctDishesThisMonth,
    ] = await Promise.all([
      this.resolveUsername(userId),
      this.prisma.db.userGoal.findFirst({
        where: { userId, priority: 'PRIMARY' },
        include: { goal: { select: { id: true, code: true, name: true } } },
      }),
      this.prisma.db.communityPost.count({
        where: { authorId: userId, status: 'ACTIVE' },
      }),
      this.prisma.db.savedDish.count({ where: { userId } }),
      this.prisma.db.userFollow.count({ where: { followingId: userId } }),
      this.prisma.db.randomHistory.count({ where: { userId } }),
      this.prisma.db.diaryMealLog.count({
        where: {
          userId,
          deletedAt: null,
          localDate: { gte: new Date(monthStart), lt: new Date(monthEnd) },
        },
      }),
      this.prisma.db.notification.count({
        where: { userId, status: 'UNREAD' },
      }),
      this.computeStreak(userId, localDate),
      this.prisma.db.diaryMealLogItem.findMany({
        where: {
          referenceType: 'DISH',
          referenceId: { not: null },
          mealLog: {
            userId,
            deletedAt: null,
            localDate: { gte: new Date(monthStart), lt: new Date(monthEnd) },
          },
        },
        select: { referenceId: true },
        distinct: ['referenceId'],
      }),
    ]);
    const draftPostCount = 0;

    const weekStartsOn = (query.weekStartsOn ?? 'MONDAY').toUpperCase();
    const dow = new Date(`${localDate}T00:00:00.000Z`).getUTCDay(); // 0=Sun
    const offsetFromMonday = weekStartsOn === 'SUNDAY' ? dow : (dow + 6) % 7;
    const weekStart = this.addDaysIso(localDate, -offsetFromMonday);
    const recentDays = Array.from({ length: 7 }, (_, i) => {
      const d = this.addDaysIso(weekStart, i);
      const has = streakInfo.dateSet.has(d);
      let status: 'COMPLETED' | 'IN_PROGRESS' | 'MISSED' | 'EMPTY' = 'EMPTY';
      if (d === localDate) status = has ? 'IN_PROGRESS' : 'EMPTY';
      else if (d < localDate) status = has ? 'COMPLETED' : 'MISSED';
      else status = 'EMPTY';
      return { localDate: d, status };
    });

    return {
      profile: {
        displayName: profile.displayName,
        username,
        avatar: {
          url: profile.avatarUrl,
          blurHash: null,
          status: profile.avatarUrl ? 'APPROVED' : 'NONE',
        },
        primaryGoal: primaryGoal?.goal ?? null,
      },
      socialStats: {
        publishedPostCount,
        savedDishCount,
        followerCount,
      },
      journeyPreview: {
        currentStreakDays: streakInfo.currentStreakDays,
        mealsLoggedThisMonth: mealsThisMonth,
        newDishesThisMonth: new Set(
          distinctDishesThisMonth.map((d) => d.referenceId).filter(Boolean),
        ).size,
        recentDays,
        definitionVersion: 'journey-v1',
      },
      shortcuts: {
        savedDishes: savedDishCount,
        randomRuns,
        mealLogsThisMonth: mealsThisMonth,
        myPublishedPosts: publishedPostCount,
        myDraftPosts: draftPostCount,
      },
      notificationUnreadCount: unreadNotifications,
      generatedAt: new Date().toISOString(),
    };
  }

  async getProfile(userId: string) {
    const profile = await this.getProfileOrThrow(userId);

    const [
      username,
      userGoals,
      userDietaryPrefs,
      userAllergens,
      userAvoidedIngredients,
      selectionPriorities,
    ] = await Promise.all([
      this.resolveUsername(userId),
      this.prisma.db.userGoal.findMany({
        where: { userId },
        include: { goal: { select: { id: true, code: true, name: true } } },
      }),
      this.prisma.db.userDietaryPreference.findMany({
        where: { userId },
        include: { preference: { select: { id: true, code: true, name: true, type: true } } },
      }),
      this.prisma.db.userAllergen.findMany({
        where: { userId },
        include: { allergen: { select: { id: true, code: true, name: true } } },
      }),
      this.prisma.db.userAvoidedIngredient.findMany({
        where: { userId },
        select: {
          id: true,
          ingredientName: true,
          ingredientId: true,
          normalizedText: true,
          mode: true,
          resolutionStatus: true,
          reasonCode: true,
        },
      }),
      this.prisma.db.userSelectionPriority
        .findMany({
          where: { userId },
          select: { code: true, weight: true },
          orderBy: { weight: 'desc' },
        })
        .catch(() => [] as Array<{ code: string; weight: number }>),
    ]);

    const primary = userGoals.find((g) => g.priority === 'PRIMARY')?.goal ?? null;
    const tastes = userDietaryPrefs
      .filter((p) => p.preference.type === 'TASTE')
      .map((p) => p.preference);
    const diets = userDietaryPrefs
      .filter((p) => p.preference.type === 'DIET')
      .map((p) => p.preference);

    const nested = {
      version: profile.profileVersion,
      basic: {
        displayName: profile.displayName,
        username,
        dateOfBirth: profile.dateOfBirth
          ? this.formatLocalDate(profile.dateOfBirth)
          : null,
        gender: profile.gender,
        bio: profile.bio ?? null,
        region: null as null | { id: string; code: string; name: string },
        locale: profile.locale,
        timezone: profile.timezone,
      },
      avatar: {
        mediaId: profile.avatarMediaId ?? null,
        url: profile.avatarUrl,
        thumbnailUrl: profile.avatarUrl,
        status: profile.avatarUrl ? 'APPROVED' : 'NONE',
      },
      healthSummary: {
        latestHeightCm: profile.heightCm,
        latestWeightKg: profile.weightKg,
        targetWeightKg: null as number | null,
        activityLevel: profile.activityLevel ?? null,
        updatedAt: profile.updatedAt,
      },
      preferences: {
        primaryGoal: primary,
        tastePreferences: tastes,
        dietTypes: diets,
        selectionPriorities,
        allergens: userAllergens.map((a) => a.allergen),
        avoidedIngredients: userAvoidedIngredients.map((i) => ({
          id: i.id,
          name: i.ingredientName,
          ingredientId: i.ingredientId,
          normalizedText: i.normalizedText ?? i.ingredientName,
          mode: i.mode,
          resolutionStatus: i.resolutionStatus,
          reasonCode: i.reasonCode,
        })),
      },
      updatedAt: profile.updatedAt,
    };

    if (profile.regionId) {
      const region = await this.prisma.db.region.findUnique({
        where: { id: profile.regionId },
        select: { id: true, code: true, name: true },
      });
      nested.basic.region = region;
    }

    return {
      ...nested,
      userId: profile.userId,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      gender: profile.gender,
      dateOfBirth: profile.dateOfBirth,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
      noAllergies: profile.noAllergies,
      onboardingStatus: profile.onboardingStatus,
      profileVersion: profile.profileVersion,
      goals: {
        primary,
        secondary: userGoals.filter((g) => g.priority === 'SECONDARY').map((g) => g.goal),
      },
      dietaryPreferences: userDietaryPrefs.map((p) => p.preference),
      allergens: userAllergens.map((a) => a.allergen),
      avoidIngredients: userAvoidedIngredients.map((i) => i.ingredientName),
    };
  }

  async getJourney(userId: string, monthParam?: string, timezoneParam?: string) {
    const profile = await this.getProfileOrThrow(userId);
    const timezone = timezoneParam ?? profile.timezone ?? 'Asia/Ho_Chi_Minh';
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
    const month = monthParam ?? todayStr.slice(0, 7);
    const { start: monthStart, endExclusive: monthEnd } = this.monthBounds(`${month}-01`, timezone);

    const [mealLogs, waterLogs, distinctDishes, streakInfo] = await Promise.all([
      this.prisma.db.diaryMealLog
        .findMany({
          where: {
            userId,
            deletedAt: null,
            localDate: { gte: new Date(monthStart), lt: new Date(monthEnd) },
          },
          select: { localDate: true },
        })
        .catch(() => [] as Array<{ localDate: Date }>),
      this.prisma.db.waterLog
        .findMany({
          where: {
            userId,
            localDate: { gte: new Date(monthStart), lt: new Date(monthEnd) },
          },
          select: { amountMl: true, localDate: true },
        })
        .catch(() => [] as Array<{ amountMl: number; localDate: Date }>),
      this.prisma.db.diaryMealLogItem
        .findMany({
          where: {
            referenceType: 'DISH',
            referenceId: { not: null },
            mealLog: {
              userId,
              deletedAt: null,
              localDate: { gte: new Date(monthStart), lt: new Date(monthEnd) },
            },
          },
          select: { referenceId: true },
          distinct: ['referenceId'],
        })
        .catch(() => [] as Array<{ referenceId: string | null }>),
      this.computeStreak(userId, todayStr),
    ]);

    const mealCountByDay = new Map<string, number>();
    for (const log of mealLogs) {
      const d = this.formatLocalDate(log.localDate);
      mealCountByDay.set(d, (mealCountByDay.get(d) ?? 0) + 1);
    }

    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const localDate = `${month}-${String(i + 1).padStart(2, '0')}`;
      const mealLogCount = mealCountByDay.get(localDate) ?? 0;
      let status: 'QUALIFIED' | 'EMPTY' | 'FUTURE' = 'EMPTY';
      if (localDate > todayStr) status = 'FUTURE';
      else if (mealLogCount > 0) status = 'QUALIFIED';
      return {
        localDate,
        status,
        mealLogCount,
        targetCompletionRatio: mealLogCount > 0 ? Math.min(mealLogCount / 3, 1) : 0,
      };
    });

    let longestStreakDays = 0;
    let run = 0;
    const sortedAsc = [...streakInfo.dateSet].sort();
    let prev: string | null = null;
    for (const d of sortedAsc) {
      if (prev) {
        const prevDate = new Date(`${prev}T00:00:00.000Z`);
        const curDate = new Date(`${d}T00:00:00.000Z`);
        const diffDays = Math.round((curDate.getTime() - prevDate.getTime()) / 86_400_000);
        run = diffDays === 1 ? run + 1 : 1;
      } else {
        run = 1;
      }
      longestStreakDays = Math.max(longestStreakDays, run);
      prev = d;
    }

    const mealsLogged = mealLogs.length;
    const distinctNewDishes = new Set(
      distinctDishes.map((d) => d.referenceId).filter(Boolean),
    ).size;
    const waterMl = waterLogs.reduce((sum, w) => sum + w.amountMl, 0);

    const achievements = await this.persistAndLoadAchievements(userId, {
      mealsLoggedAllTime: streakInfo.dateSet.size,
      currentStreakDays: streakInfo.currentStreakDays,
      distinctDishes: distinctNewDishes,
    });

    return {
      month,
      timezone,
      streak: {
        currentDays: streakInfo.currentStreakDays,
        longestDays: longestStreakDays,
        lastQualifiedLocalDate: [...streakInfo.dateSet].sort().at(-1) ?? null,
        definitionVersion: 'meal-log-one-per-day-v1',
      },
      currentStreakDays: streakInfo.currentStreakDays,
      longestStreakDays,
      days,
      achievements,
      badges: achievements.filter((a) => a.earnedAt).map((a) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        earnedAt: a.earnedAt,
      })),
      monthlyGoals: [
        { code: 'MEAL_LOGS', label: 'Ghi bữa ăn', current: mealsLogged, target: 60, unit: 'MEAL' },
        { code: 'NEW_DISHES', label: 'Thử món mới', current: distinctNewDishes, target: 10, unit: 'DISH' },
        {
          code: 'WATER_TARGET_DAYS',
          label: 'Uống đủ nước',
          current: new Set(waterLogs.map((w) => this.formatLocalDate(w.localDate))).size,
          target: daysInMonth,
          unit: 'DAY',
        },
      ],
      totals: {
        mealsLogged,
        distinctNewDishes,
        waterMl,
        waterMlLogged: waterMl,
      },
      dataCoverage: {
        mealLogs: mealLogs.length > 0 ? 1 : 0,
        water: waterLogs.length > 0 ? 0.87 : 0,
        activity: 0,
      },
    };
  }

  private async persistAndLoadAchievements(
    userId: string,
    stats: { mealsLoggedAllTime: number; currentStreakDays: number; distinctDishes: number },
  ) {
    try {
      const defs = await this.prisma.db.achievementDefinition.findMany({
        where: { active: true },
      });
      const progressByCode: Record<string, number> = {
        FIRST_LOG: stats.mealsLoggedAllTime >= 1 ? 1 : 0,
        STREAK_7: Math.min(stats.currentStreakDays, 7),
        EXPLORER_10: Math.min(stats.distinctDishes, 10),
      };

      for (const def of defs) {
        const progress = progressByCode[def.code] ?? 0;
        const earned = progress >= def.targetValue;
        await this.prisma.db.userAchievement.upsert({
          where: {
            userId_achievementId: { userId, achievementId: def.id },
          },
          create: {
            userId,
            achievementId: def.id,
            progress,
            earnedAt: earned ? new Date() : null,
          },
          update: {
            progress,
          },
        });
        if (earned) {
          await this.prisma.db.userAchievement.updateMany({
            where: { userId, achievementId: def.id, earnedAt: null },
            data: { earnedAt: new Date() },
          });
        }
      }

      const rows = await this.prisma.db.userAchievement.findMany({
        where: { userId },
        include: { achievement: true },
      });
      return rows.map((r) => ({
        id: r.id,
        code: r.achievement.code,
        name: r.achievement.name,
        description: r.achievement.description,
        progress: r.progress,
        target: r.achievement.targetValue,
        earnedAt: r.earnedAt?.toISOString() ?? null,
        iconKey: r.achievement.iconKey,
      }));
    } catch {
      return [] as Array<{
        id: string;
        code: string;
        name: string;
        description: string | null;
        progress: number;
        target: number;
        earnedAt: string | null;
        iconKey: string | null;
      }>;
    }
  }

  async putAvoidances(userId: string, items: Array<{
    ingredientId?: string;
    text?: string;
    mode?: 'SOFT' | 'HARD';
    reasonCode?: string;
  }>) {
    await this.getProfileOrThrow(userId);

    const normalized = items
      .map((item) => {
        const text = (item.text ?? '').trim();
        const ingredientId = item.ingredientId ?? null;
        if (!text && !ingredientId) return null;
        const ingredientName = text || ingredientId!;
        return {
          ingredientName: ingredientName.slice(0, 80),
          ingredientId,
          normalizedText: ingredientName.toLowerCase().slice(0, 120),
          mode: item.mode ?? 'SOFT',
          resolutionStatus: ingredientId ? 'RESOLVED' : 'FREE_TEXT',
          reasonCode: item.reasonCode ?? null,
        } as const;
      })
      .filter(Boolean) as Array<{
      ingredientName: string;
      ingredientId: string | null;
      normalizedText: string;
      mode: 'SOFT' | 'HARD';
      resolutionStatus: 'RESOLVED' | 'FREE_TEXT';
      reasonCode: string | null;
    }>;

    await this.prisma.db.$transaction(async (tx) => {
      await tx.userAvoidedIngredient.deleteMany({ where: { userId } });
      for (const row of normalized) {
        await tx.userAvoidedIngredient.create({
          data: {
            userId,
            ingredientName: row.ingredientName,
            ingredientId: row.ingredientId,
            normalizedText: row.normalizedText,
            mode: row.mode,
            resolutionStatus: row.resolutionStatus as any,
            reasonCode: row.reasonCode,
          },
        });
      }
    });

    const profile = await this.getProfile(userId);
    return {
      avoidedIngredients: profile.preferences.avoidedIngredients,
      profileVersion: profile.profileVersion,
    };
  }

  async getHealthProfile(userId: string) {
    const profile = await this.getProfileOrThrow(userId);
    const [height, weight, target] = await Promise.all([
      this.prisma.db.profileMeasurement.findFirst({
        where: { userId, type: 'HEIGHT_CM' },
        orderBy: { measuredAt: 'desc' },
      }),
      this.prisma.db.profileMeasurement.findFirst({
        where: { userId, type: 'WEIGHT_KG' },
        orderBy: { measuredAt: 'desc' },
      }),
      this.prisma.db.healthTarget.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const heightCm = height ? Number(height.valueDecimal) : profile.heightCm;
    const weightKg = weight ? Number(weight.valueDecimal) : profile.weightKg;
    let bmi: {
      value: number | null;
      status: string;
      method: string;
      applicability: string;
      calculatedAt: string;
    } = {
      value: null,
      status: 'INSUFFICIENT_INPUT',
      method: 'WEIGHT_KG_DIV_HEIGHT_M_SQUARED',
      applicability: 'ADULT_SCREENING_ONLY',
      calculatedAt: new Date().toISOString(),
    };
    if (heightCm && weightKg && heightCm > 0) {
      const value = weightKg / Math.pow(heightCm / 100, 2);
      bmi = {
        ...bmi,
        value,
        status: 'AVAILABLE',
      };
    }

    return {
      latestMeasurements: {
        height: heightCm
          ? {
              value: heightCm,
              unit: 'cm',
              measuredAt: height?.measuredAt?.toISOString() ?? profile.updatedAt.toISOString(),
            }
          : null,
        weight: weightKg
          ? {
              value: weightKg,
              unit: 'kg',
              measuredAt: weight?.measuredAt?.toISOString() ?? profile.updatedAt.toISOString(),
            }
          : null,
      },
      bmi,
      targetWeight: null,
      activityLevel: profile.activityLevel ?? null,
      dailyTargets: target
        ? {
            energyKcal: target.energyKcal,
            proteinG: target.proteinG,
            carbsG: target.carbsG,
            fatG: target.fatG,
            waterMl: target.waterMl,
            steps: target.steps,
            mode: target.mode,
            method: null,
            formulaVersion: null,
            inputsUsed: [],
            requiresProfessionalReview: false,
            version: target.version,
          }
        : null,
      warnings: [],
    };
  }

  async createAvatarUploadIntent(
    userId: string,
    dto: {
      mimeType: string;
      sizeBytes: number;
      sha256?: string;
      width?: number;
      height?: number;
    },
  ) {
    await this.getProfileOrThrow(userId);
    const mimeType =
      dto.mimeType === 'image/jpg' ? 'image/jpeg' : dto.mimeType?.toLowerCase?.() ?? dto.mimeType;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(mimeType)) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_MIME',
          message: 'Chỉ chấp nhận JPEG/PNG/WebP.',
        },
      });
    }
    if (!Number.isFinite(dto.sizeBytes) || dto.sizeBytes < 1) {
      throw new BadRequestException({
        error: {
          code: 'INVALID_SIZE',
          message: 'Thiếu hoặc sai dung lượng ảnh (sizeBytes).',
        },
      });
    }
    if (dto.sizeBytes > 5 * 1024 * 1024) {
      throw new BadRequestException({
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'Ảnh tối đa 5MiB.',
        },
      });
    }

    const mediaId = randomUUID();
    const ext =
      mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const objectKey = `avatars/${userId}/${mediaId}.${ext}`;
    const supabaseUrl =
      this.config.get<string>('SUPABASE_URL')?.replace(/\/$/, '') ??
      'https://placeholder.supabase.co';
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    let uploadUrl = `${supabaseUrl}/storage/v1/object/upload/sign/${this.avatarBucket}/${objectKey}?token=stub`;
    if (this.supabase) {
      const { data, error } = await this.supabase.storage
        .from(this.avatarBucket)
        .createSignedUploadUrl(objectKey, { upsert: true });
      if (error || !data?.signedUrl) {
        this.logger.error(
          `Avatar createSignedUploadUrl failed: ${JSON.stringify(error)}`,
          { userId, objectKey, bucket: this.avatarBucket },
        );
        throw new BadRequestException({
          error: {
            code: 'PRESIGN_FAILED',
            message: `Không tạo được URL upload ảnh: ${error?.message ?? 'Unknown error'}`,
          },
        });
      }
      uploadUrl = data.signedUrl;
    }

    const media = await this.prisma.db.userMedia.create({
      data: {
        id: mediaId,
        userId,
        purpose: 'AVATAR',
        objectKey,
        mimeType,
        sizeBytes: dto.sizeBytes,
        width: dto.width ?? null,
        height: dto.height ?? null,
        checksumSha256: dto.sha256 ?? null,
        status: 'UPLOAD_PENDING',
      },
    });

    return {
      mediaId: media.id,
      upload: {
        method: 'PUT',
        url: uploadUrl,
        headers: { 'content-type': mimeType },
        expiresAt: expiresAt.toISOString(),
      },
      maxSizeBytes: 5 * 1024 * 1024,
      allowedMimeTypes: allowed,
    };
  }

  async finalizeAvatarUpload(userId: string, mediaId: string) {
    const media = await this.prisma.db.userMedia.findFirst({
      where: { id: mediaId, userId, purpose: 'AVATAR', deletedAt: null },
    });
    if (!media) {
      throw new NotFoundException({ code: 'MEDIA_NOT_FOUND', message: 'Không tìm thấy media.' });
    }

    const supabaseUrl =
      this.config.get<string>('SUPABASE_URL')?.replace(/\/$/, '') ??
      'https://placeholder.supabase.co';
    const avatarUrl = `${supabaseUrl}/storage/v1/object/public/${this.avatarBucket}/${media.objectKey}`;

    await this.prisma.db.$transaction([
      this.prisma.db.userMedia.update({
        where: { id: mediaId },
        data: { status: 'APPROVED', variants: { '128': avatarUrl, '512': avatarUrl } },
      }),
      this.prisma.db.profile.update({
        where: { userId },
        data: {
          avatarMediaId: mediaId,
          avatarUrl,
          profileVersion: { increment: 1 },
        },
      }),
    ]);

    return {
      mediaId,
      status: 'APPROVED',
      url: avatarUrl,
      thumbnailUrl: avatarUrl,
    };
  }

  async getAvatar(userId: string) {
    const profile = await this.getProfileOrThrow(userId);
    const media = profile.avatarMediaId
      ? await this.prisma.db.userMedia.findUnique({ where: { id: profile.avatarMediaId } })
      : await this.prisma.db.userMedia.findFirst({
          where: { userId, purpose: 'AVATAR', deletedAt: null },
          orderBy: { createdAt: 'desc' },
        });

    return {
      mediaId: media?.id ?? null,
      url: profile.avatarUrl,
      thumbnailUrl: profile.avatarUrl,
      status: media?.status ?? (profile.avatarUrl ? 'APPROVED' : 'NONE'),
    };
  }

  async deleteAvatar(userId: string, profileVersionHeader?: string) {
    const profile = await this.getProfileOrThrow(userId);
    this.validateVersion(profileVersionHeader, profile.profileVersion);

    await this.prisma.db.$transaction(async (tx) => {
      if (profile.avatarMediaId) {
        await tx.userMedia.update({
          where: { id: profile.avatarMediaId },
          data: { status: 'DELETED', deletedAt: new Date() },
        });
      }
      const updated = await tx.profile.updateMany({
        where: { userId, profileVersion: profile.profileVersion },
        data: {
          avatarUrl: null,
          avatarMediaId: null,
          profileVersion: { increment: 1 },
        },
      });
      if (updated.count === 0) {
        throw new PreconditionFailedException({
          code: 'PROFILE_VERSION_CONFLICT',
          detail: 'Hồ sơ đã được cập nhật trên thiết bị khác.',
        });
      }
    });

    return { deleted: true };
  }
}
