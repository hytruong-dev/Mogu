import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateBasicDto } from './dto/update-basic.dto';
import { UpdateHealthDto } from './dto/update-health.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async getProfileOrThrow(userId: string) {
    const profile = await this.prisma.db.profile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException({ code: 'PROFILE_NOT_FOUND', message: 'Không tìm thấy profile.' });
    }
    return profile;
  }

  /**
   * PATCH /v1/profile/basic — Cập nhật tên, ngày sinh, giới tính
   */
  async updateBasic(userId: string, dto: UpdateBasicDto, profileVersion: number) {
    const profile = await this.getProfileOrThrow(userId);

    if (profileVersion !== profile.profileVersion) {
      throw new ConflictException({
        code: 'ONB_003',
        message: 'Thông tin của bạn vừa được cập nhật ở nơi khác. Vui lòng tải lại.',
      });
    }

    const updateData: Record<string, unknown> = {};

    if (dto.displayName !== undefined) {
      updateData.displayName = dto.displayName;
    }
    if (dto.gender !== undefined) {
      updateData.gender = dto.gender;
    }
    if (dto.dateOfBirth !== undefined) {
      if (dto.dateOfBirth !== null) {
        const dob = new Date(dto.dateOfBirth);
        if (dob >= new Date()) {
          throw new BadRequestException({
            code: 'ONB_002',
            message: 'Ngày sinh chưa hợp lệ. Vui lòng kiểm tra lại.',
            field: 'dateOfBirth',
          });
        }
        updateData.dateOfBirth = dob;
      } else {
        updateData.dateOfBirth = null;
      }
    }

    updateData.profileVersion = profile.profileVersion + 1;

    const updated = await this.prisma.db.profile.update({
      where: { userId },
      data: updateData,
      select: {
        displayName: true,
        gender: true,
        dateOfBirth: true,
        profileVersion: true,
        updatedAt: true,
      },
    });

    // Invalidate allergen thay đổi: cập nhật confirmed_at
    if (profile.onboardingStatus === 'COMPLETED') {
      this.logger.log(`Profile basic updated post-onboarding for userId=${userId}`);
    }

    return { ...updated, message: 'Thông tin cơ bản đã được cập nhật.' };
  }

  /**
   * PATCH /v1/profile/health — Cập nhật chiều cao, cân nặng
   */
  async updateHealth(userId: string, dto: UpdateHealthDto, profileVersion: number) {
    const profile = await this.getProfileOrThrow(userId);

    if (profileVersion !== profile.profileVersion) {
      throw new ConflictException({
        code: 'ONB_003',
        message: 'Thông tin của bạn vừa được cập nhật ở nơi khác. Vui lòng tải lại.',
      });
    }

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

  /**
   * PATCH /v1/profile/preferences — Cập nhật mục tiêu, sở thích, dị ứng
   */
  async updatePreferences(userId: string, dto: UpdatePreferencesDto, profileVersion: number) {
    const profile = await this.getProfileOrThrow(userId);

    if (profileVersion !== profile.profileVersion) {
      throw new ConflictException({
        code: 'ONB_003',
        message: 'Thông tin của bạn vừa được cập nhật ở nơi khác. Vui lòng tải lại.',
      });
    }

    // noAllergies XOR allergenIds
    if (dto.noAllergies && dto.allergenIds && dto.allergenIds.length > 0) {
      throw new BadRequestException({
        code: 'ONB_002',
        message: 'Hãy kiểm tra lại thông tin dị ứng.',
        field: 'allergenIds',
      });
    }

    // Goals
    if (dto.primaryGoalId !== undefined) {
      const primaryGoal = await this.prisma.db.goal.findUnique({
        where: { id: dto.primaryGoalId },
      });
      if (!primaryGoal || !primaryGoal.active) {
        throw new BadRequestException({
          code: 'ONB_004',
          message: 'Một lựa chọn không còn khả dụng.',
          field: 'primaryGoalId',
        });
      }

      const secondaryIds = dto.secondaryGoalIds ?? [];
      if (secondaryIds.includes(dto.primaryGoalId)) {
        throw new BadRequestException({
          code: 'ONB_002',
          message: 'Mục tiêu phụ không được trùng với mục tiêu chính.',
          field: 'secondaryGoalIds',
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

    // Dietary preferences
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

    // Allergens — cảnh báo: thay đổi dị ứng có hiệu lực ngay
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
      this.logger.warn(`Allergen data updated for userId=${userId} — effective immediately`);
    }

    // Avoided ingredients
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

    // Increment profile version
    const updated = await this.prisma.db.profile.update({
      where: { userId },
      data: { profileVersion: profile.profileVersion + 1 },
      select: { profileVersion: true, updatedAt: true },
    });

    return {
      ...updated,
      message: 'Sở thích và mục tiêu đã được cập nhật.',
      allergenWarning:
        dto.allergenIds !== undefined || dto.noAllergies !== undefined
          ? 'Thay đổi dị ứng có hiệu lực ngay từ lần gợi ý tiếp theo. Mogu không cam kết món ăn hoàn toàn không chứa chất gây dị ứng — vui lòng kiểm tra nhãn sản phẩm.'
          : undefined,
    };
  }

  /**
   * GET /v1/profile/me — Lấy thông tin profile đầy đủ
   */
  async getProfile(userId: string) {
    const profile = await this.getProfileOrThrow(userId);

    const [userGoals, userDietaryPrefs, userAllergens, userAvoidedIngredients] =
      await Promise.all([
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
          select: { ingredientName: true },
        }),
      ]);

    return {
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
        primary: userGoals.find((g) => g.priority === 'PRIMARY')?.goal ?? null,
        secondary: userGoals
          .filter((g) => g.priority === 'SECONDARY')
          .map((g) => g.goal),
      },
      dietaryPreferences: userDietaryPrefs.map((p) => p.preference),
      allergens: userAllergens.map((a) => a.allergen),
      avoidIngredients: userAvoidedIngredients.map((i) => i.ingredientName),
    };
  }
}
