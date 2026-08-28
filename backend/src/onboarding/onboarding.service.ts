import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SaveStepNameDto } from './dto/save-step-name.dto';
import { SaveStepBirthdayDto } from './dto/save-step-birthday.dto';
import { SaveStepGenderDto } from './dto/save-step-gender.dto';
import { SaveStepBodyDto } from './dto/save-step-body.dto';
import { SaveStepGoalDto } from './dto/save-step-goal.dto';
import { SaveStepPreferencesDto } from './dto/save-step-preferences.dto';

// ─────────────────────────────────────────────────────────────────────────────
// Step config
// ─────────────────────────────────────────────────────────────────────────────
interface StepConfig {
  step: number;
  name: string;
  skippable: boolean;
  hasData: boolean;
}

const STEP_CONFIG: StepConfig[] = [
  { step: 1, name: 'welcome', skippable: false, hasData: false },
  { step: 2, name: 'name', skippable: true, hasData: true },
  { step: 3, name: 'birthday', skippable: false, hasData: true },
  { step: 4, name: 'gender', skippable: true, hasData: true },
  { step: 5, name: 'body', skippable: true, hasData: true },
  { step: 6, name: 'goal', skippable: false, hasData: true },
  { step: 7, name: 'preferences', skippable: true, hasData: true },
  { step: 8, name: 'summary', skippable: false, hasData: false },
];

const TOTAL_STEPS = 8;

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────
@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ──────────────────────────────────────────────────────────────

  private getStepConfig(step: number): StepConfig {
    const config = STEP_CONFIG.find((s) => s.step === step);
    if (!config) {
      throw new BadRequestException({
        code: 'ONB_001',
        message: 'Bước onboarding không hợp lệ.',
      });
    }
    return config;
  }

  private async getProfileOrThrow(userId: string) {
    const profile = await this.prisma.db.profile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException({
        code: 'ONB_002',
        message: 'Không tìm thấy profile người dùng.',
      });
    }
    if (profile.accountStatus !== 'ACTIVE') {
      throw new ForbiddenException({
        code: 'ONB_002',
        message: 'Tài khoản chưa được kích hoạt.',
      });
    }
    return profile;
  }

  private async getOrCreateSession(userId: string) {
    const existing = await this.prisma.db.onboardingSession.findUnique({
      where: { userId },
    });
    return existing;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * GET /onboarding — Lấy state + draft hiện tại
   */
  async getState(userId: string) {
    const profile = await this.getProfileOrThrow(userId);
    const session = await this.prisma.db.onboardingSession.findUnique({
      where: { userId },
    });

    return {
      onboardingStatus: profile.onboardingStatus,
      currentStep: session?.currentStep ?? 1,
      totalSteps: TOTAL_STEPS,
      profileVersion: profile.profileVersion,
      onboardingVersion: session?.onboardingVersion ?? '1.0',
      draft: session?.dataJson ?? {},
      completedAt: session?.completedAt ?? null,
    };
  }

  /**
   * POST /onboarding/start — Khởi tạo session idempotent
   */
  async start(userId: string) {
    const profile = await this.getProfileOrThrow(userId);

    // Idempotent: nếu đã COMPLETED thì return luôn
    if (profile.onboardingStatus === 'COMPLETED') {
      return {
        alreadyCompleted: true,
        onboardingStatus: 'COMPLETED',
        currentStep: TOTAL_STEPS,
        nextStep: null,
      };
    }

    // Upsert session
    const session = await this.prisma.db.onboardingSession.upsert({
      where: { userId },
      update: {}, // nếu đã có, không đổi gì
      create: {
        userId,
        onboardingVersion: '1.0',
        currentStep: 1,
        status: 'IN_PROGRESS',
      },
    });

    // Update profile nếu chưa IN_PROGRESS
    if (
      profile.onboardingStatus === 'NOT_STARTED' ||
      profile.onboardingStatus === 'SKIPPED'
    ) {
      await this.prisma.db.profile.update({
        where: { userId },
        data: { onboardingStatus: 'IN_PROGRESS', onboardingStep: 1 },
      });
    }

    return {
      alreadyCompleted: false,
      onboardingStatus: 'IN_PROGRESS',
      currentStep: session.currentStep,
      nextStep: session.currentStep + 1,
    };
  }

  /**
   * PATCH /onboarding/steps/:step — Lưu dữ liệu bước
   */
  async saveStep(
    userId: string,
    step: number,
    dto:
      | SaveStepNameDto
      | SaveStepBirthdayDto
      | SaveStepGenderDto
      | SaveStepBodyDto
      | SaveStepGoalDto
      | SaveStepPreferencesDto,
    profileVersion: number,
  ) {
    const stepConfig = this.getStepConfig(step);
    await this.getProfileOrThrow(userId);

    const session = await this.getOrCreateSession(userId);
    if (!session) {
      throw new BadRequestException({
        code: 'ONB_001',
        message: 'Chưa bắt đầu onboarding. Gọi POST /onboarding/start trước.',
      });
    }

    // Version conflict check
    const profile = await this.prisma.db.profile.findUnique({ where: { userId } });
    if (profile && profileVersion !== profile.profileVersion) {
      throw new ConflictException({
        code: 'ONB_003',
        message: 'Thông tin của bạn vừa được cập nhật ở nơi khác. Vui lòng tải lại.',
      });
    }

    // Merge data vào draft
    const currentDraft =
      session.dataJson && typeof session.dataJson === 'object' && !Array.isArray(session.dataJson)
        ? (session.dataJson as Record<string, unknown>)
        : {};
    const stepKey = stepConfig.name;
    const updatedDraft: Record<string, unknown> = {
      ...currentDraft,
      [stepKey]: dto as unknown,
    };

    // Tính next step
    const nextStep = step < TOTAL_STEPS ? step + 1 : null;

    // Apply data vào profile dựa theo step
    await this.applyStepToProfile(userId, step, dto);

    // Update session
    await this.prisma.db.onboardingSession.update({
      where: { userId },
      data: {
        currentStep: Math.max(session.currentStep, nextStep ?? step),
        dataJson: updatedDraft as Prisma.InputJsonValue,
        status: 'IN_PROGRESS',
      },
    });

    // Update profile onboarding step
    await this.prisma.db.profile.update({
      where: { userId },
      data: {
        onboardingStep: Math.max(profile?.onboardingStep ?? 0, nextStep ?? step),
        updatedAt: new Date(),
      },
    });

    return {
      savedStep: step,
      stepName: stepConfig.name,
      currentStep: step,
      nextStep,
      profileVersion: profile?.profileVersion ?? 1,
    };
  }

  /**
   * POST /onboarding/steps/:step/skip — Skip bước được phép
   */
  async skipStep(userId: string, step: number) {
    const stepConfig = this.getStepConfig(step);

    if (!stepConfig.skippable) {
      throw new BadRequestException({
        code: 'ONB_001',
        message: `Bước ${step} không thể bỏ qua.`,
      });
    }

    const session = await this.getOrCreateSession(userId);
    if (!session) {
      throw new BadRequestException({
        code: 'ONB_001',
        message: 'Chưa bắt đầu onboarding. Gọi POST /onboarding/start trước.',
      });
    }

    const nextStep = step < TOTAL_STEPS ? step + 1 : null;
    const currentDraft =
      session.dataJson && typeof session.dataJson === 'object' && !Array.isArray(session.dataJson)
        ? (session.dataJson as Record<string, unknown>)
        : {};

    const skippedDraft: Record<string, unknown> = {
      ...currentDraft,
      [`${stepConfig.name}_skipped`]: true,
    };

    // Đánh dấu skipped trong draft
    await this.prisma.db.onboardingSession.update({
      where: { userId },
      data: {
        currentStep: Math.max(session.currentStep, nextStep ?? step),
        dataJson: skippedDraft as Prisma.InputJsonValue,
      },
    });

    return {
      skippedStep: step,
      stepName: stepConfig.name,
      nextStep,
    };
  }

  /**
   * GET /onboarding/summary — Tóm tắt để review ở Step 8
   */
  async getSummary(userId: string) {
    const profile = await this.getProfileOrThrow(userId);

    const [userGoals, userDietaryPrefs, userAllergens, userAvoidedIngredients] =
      await Promise.all([
        this.prisma.db.userGoal.findMany({
          where: { userId },
          include: { goal: { select: { id: true, code: true, name: true } } },
        }),
        this.prisma.db.userDietaryPreference.findMany({
          where: { userId },
          include: {
            preference: { select: { id: true, code: true, name: true, type: true } },
          },
        }),
        this.prisma.db.userAllergen.findMany({
          where: { userId },
          include: { allergen: { select: { id: true, code: true, name: true } } },
        }),
        this.prisma.db.userAvoidedIngredient.findMany({
          where: { userId },
          select: { id: true, ingredientName: true, reason: true },
        }),
      ]);

    const primaryGoal = userGoals.find((g) => g.priority === 'PRIMARY');
    const secondaryGoals = userGoals.filter((g) => g.priority === 'SECONDARY');

    return {
      profile: {
        displayName: profile.displayName,
        dateOfBirth: profile.dateOfBirth,
        gender: profile.gender,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        noAllergies: profile.noAllergies,
      },
      goals: {
        primary: primaryGoal
          ? { id: primaryGoal.goal.id, code: primaryGoal.goal.code, name: primaryGoal.goal.name }
          : null,
        secondary: secondaryGoals.map((g) => ({
          id: g.goal.id,
          code: g.goal.code,
          name: g.goal.name,
        })),
      },
      dietaryPreferences: userDietaryPrefs.map((p) => ({
        id: p.preference.id,
        code: p.preference.code,
        name: p.preference.name,
        type: p.preference.type,
      })),
      allergens: userAllergens.map((a) => ({
        id: a.allergen.id,
        code: a.allergen.code,
        name: a.allergen.name,
      })),
      avoidIngredients: userAvoidedIngredients.map((i) => i.ingredientName),
      onboardingStatus: profile.onboardingStatus,
      profileVersion: profile.profileVersion,
    };
  }

  /**
   * POST /onboarding/complete — Hoàn tất idempotent
   */
  async complete(userId: string, profileVersion: number) {
    const profile = await this.getProfileOrThrow(userId);

    // Idempotent: đã COMPLETED rồi thì trả về kết quả ngay
    if (profile.onboardingStatus === 'COMPLETED') {
      return {
        alreadyCompleted: true,
        onboardingStatus: 'COMPLETED',
        profileVersion: profile.profileVersion,
        completedAt: profile.completedAt,
        nextStep: 'HOME',
      };
    }

    // Version conflict check
    if (profileVersion !== profile.profileVersion) {
      throw new ConflictException({
        code: 'ONB_003',
        message: 'Thông tin của bạn vừa được cập nhật ở nơi khác. Vui lòng tải lại.',
      });
    }

    // Validate dữ liệu bắt buộc: primary_goal
    const primaryGoal = await this.prisma.db.userGoal.findFirst({
      where: { userId, priority: 'PRIMARY' },
    });
    if (!primaryGoal) {
      throw new BadRequestException({
        code: 'ONB_002',
        message: 'Hãy chọn một mục tiêu chính trước khi hoàn tất.',
        field: 'primaryGoalId',
      });
    }

    const now = new Date();
    const newVersion = profile.profileVersion + 1;

    // Transaction: update profile + session
    await this.prisma.db.$transaction([
      this.prisma.db.profile.update({
        where: { userId },
        data: {
          onboardingStatus: 'COMPLETED',
          onboardingStep: TOTAL_STEPS,
          profileVersion: newVersion,
          completedAt: now,
        },
      }),
      this.prisma.db.onboardingSession.update({
        where: { userId },
        data: {
          status: 'COMPLETED',
          currentStep: TOTAL_STEPS,
          completedAt: now,
        },
      }),
    ]);

    this.logger.log(`Onboarding completed for userId=${userId} version=${newVersion}`);

    return {
      alreadyCompleted: false,
      onboardingStatus: 'COMPLETED',
      profileVersion: newVersion,
      completedAt: now,
      nextStep: 'HOME',
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async applyStepToProfile(
    userId: string,
    step: number,
    dto: unknown,
  ) {
    switch (step) {
      case 2: {
        const d = dto as SaveStepNameDto;
        await this.prisma.db.profile.update({
          where: { userId },
          data: { displayName: d.displayName ?? null },
        });
        break;
      }
      case 3: {
        const d = dto as SaveStepBirthdayDto;
        // Validate không tương lai
        const dob = new Date(d.dateOfBirth);
        if (dob >= new Date()) {
          throw new BadRequestException({
            code: 'ONB_002',
            message: 'Ngày sinh chưa hợp lệ. Vui lòng kiểm tra lại.',
            field: 'dateOfBirth',
          });
        }
        await this.prisma.db.profile.update({
          where: { userId },
          data: { dateOfBirth: dob },
        });
        break;
      }
      case 4: {
        const d = dto as SaveStepGenderDto;
        await this.prisma.db.profile.update({
          where: { userId },
          data: { gender: d.gender ?? null },
        });
        break;
      }
      case 5: {
        const d = dto as SaveStepBodyDto;
        await this.prisma.db.profile.update({
          where: { userId },
          data: {
            heightCm: d.heightCm ?? null,
            weightKg: d.weightKg ?? null,
          },
        });
        break;
      }
      case 6: {
        const d = dto as SaveStepGoalDto;

        // Validate goalId tồn tại và active
        const primaryGoal = await this.prisma.db.goal.findUnique({
          where: { id: d.primaryGoalId },
        });
        if (!primaryGoal || !primaryGoal.active) {
          throw new BadRequestException({
            code: 'ONB_004',
            message: 'Một lựa chọn không còn khả dụng.',
            field: 'primaryGoalId',
          });
        }

        // Validate secondary goals không trùng primary
        const secondaryIds = d.secondaryGoalIds ?? [];
        if (secondaryIds.includes(d.primaryGoalId)) {
          throw new BadRequestException({
            code: 'ONB_002',
            message: 'Mục tiêu phụ không được trùng với mục tiêu chính.',
            field: 'secondaryGoalIds',
          });
        }

        // Xóa goals cũ và tạo lại
        await this.prisma.db.userGoal.deleteMany({ where: { userId } });
        await this.prisma.db.userGoal.create({
          data: { userId, goalId: d.primaryGoalId, priority: 'PRIMARY' },
        });
        for (const secondaryId of secondaryIds) {
          const secondaryGoal = await this.prisma.db.goal.findUnique({
            where: { id: secondaryId },
          });
          if (secondaryGoal?.active) {
            await this.prisma.db.userGoal.create({
              data: { userId, goalId: secondaryId, priority: 'SECONDARY' },
            });
          }
        }
        break;
      }
      case 7: {
        const d = dto as SaveStepPreferencesDto;

        // noAllergies XOR allergenIds validation
        if (d.noAllergies && d.allergenIds && d.allergenIds.length > 0) {
          throw new BadRequestException({
            code: 'ONB_002',
            message: 'Hãy kiểm tra lại thông tin dị ứng.',
            field: 'allergenIds',
          });
        }

        // Update noAllergies flag
        await this.prisma.db.profile.update({
          where: { userId },
          data: { noAllergies: d.noAllergies ?? false },
        });

        // Dietary preferences — replace all
        await this.prisma.db.userDietaryPreference.deleteMany({ where: { userId } });
        for (const prefId of d.dietaryPreferenceIds ?? []) {
          const pref = await this.prisma.db.dietaryPreference.findUnique({
            where: { id: prefId },
          });
          if (pref?.active) {
            await this.prisma.db.userDietaryPreference.create({
              data: { userId, preferenceId: prefId },
            });
          }
        }

        // Allergens — replace all
        await this.prisma.db.userAllergen.deleteMany({ where: { userId } });
        if (!d.noAllergies) {
          for (const allergenId of d.allergenIds ?? []) {
            const allergen = await this.prisma.db.allergen.findUnique({
              where: { id: allergenId },
            });
            if (allergen?.active) {
              await this.prisma.db.userAllergen.create({
                data: { userId, allergenId, confirmedAt: new Date() },
              });
            }
          }
        }

        // Avoided ingredients — replace all
        await this.prisma.db.userAvoidedIngredient.deleteMany({ where: { userId } });
        for (const name of d.avoidIngredients ?? []) {
          const trimmed = name.trim();
          if (trimmed) {
            await this.prisma.db.userAvoidedIngredient.create({
              data: { userId, ingredientName: trimmed },
            });
          }
        }
        break;
      }
      default:
        // Step 1 (welcome) và 8 (summary) — không lưu data profile
        break;
    }
  }
}
