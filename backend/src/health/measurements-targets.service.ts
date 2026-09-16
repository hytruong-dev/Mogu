import {
  Injectable,
  NotFoundException,
  PreconditionFailedException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateMeasurementDto {
  type: string;
  value: number;
  unit?: string;
  measuredAt?: string;
}

export interface UpdateHealthTargetDto {
  mode?: string;
  energyKcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  waterMl?: number;
  steps?: number;
}

@Injectable()
export class MeasurementsTargetsService {
  constructor(private readonly prisma: PrismaService) {}

  async createMeasurement(userId: string, dto: CreateMeasurementDto) {
    const record = await (this.prisma.db as any).profileMeasurement.create({
      data: {
        userId,
        type: dto.type,
        valueDecimal: dto.value,
        unit: dto.unit ?? (dto.type === 'HEIGHT_CM' ? 'cm' : 'kg'),
        measuredAt: dto.measuredAt ? new Date(dto.measuredAt) : new Date(),
      },
    });

    return {
      id: record.id,
      userId: record.userId,
      type: record.type,
      value: Number(record.valueDecimal),
      unit: record.unit,
      measuredAt: record.measuredAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
    };
  }

  async listMeasurements(userId: string, type?: string, limit = 20) {
    const records = await (this.prisma.db as any).profileMeasurement.findMany({
      where: {
        userId,
        ...(type ? { type } : {}),
      },
      orderBy: { measuredAt: 'desc' },
      take: Number(limit),
    });

    return {
      items: records.map((r: any) => ({
        id: r.id,
        userId: r.userId,
        type: r.type,
        value: Number(r.valueDecimal),
        unit: r.unit,
        measuredAt: r.measuredAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  async getHealthTarget(userId: string) {
    const target = await (this.prisma.db as any).healthTarget.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    if (!target) {
      const profile = await this.prisma.db.profile.findUnique({
        where: { userId },
        select: { dateOfBirth: true, activityLevel: true, heightCm: true, weightKg: true },
      });
      const missingInputs: string[] = [];
      if (!profile?.dateOfBirth) missingInputs.push('dateOfBirth');
      if (!profile?.activityLevel) missingInputs.push('activityLevel');
      if (!profile?.heightCm) missingInputs.push('heightCm');
      if (!profile?.weightKg) missingInputs.push('weightKg');

      return {
        status: 'INSUFFICIENT_INPUT',
        missingInputs: missingInputs.length
          ? missingInputs
          : ['energyTargetNotConfigured'],
        dailyTargets: null,
      };
    }

    return {
      status: 'AVAILABLE',
      id: target.id,
      userId: target.userId,
      mode: target.mode,
      energyKcal: target.energyKcal,
      proteinG: target.proteinG,
      carbsG: target.carbsG,
      fatG: target.fatG,
      waterMl: target.waterMl,
      steps: target.steps,
      version: target.version,
      updatedAt: target.updatedAt.toISOString(),
      dailyTargets: {
        energyKcal: target.energyKcal,
        proteinG: target.proteinG,
        carbsG: target.carbsG,
        fatG: target.fatG,
        waterMl: target.waterMl,
        steps: target.steps,
        mode: target.mode,
        version: target.version,
      },
    };
  }

  async recalculateHealthTarget(userId: string) {
    const profile = await this.prisma.db.profile.findUnique({
      where: { userId },
      select: {
        dateOfBirth: true,
        activityLevel: true,
        heightCm: true,
        weightKg: true,
        gender: true,
      },
    });

    const missingInputs: string[] = [];
    if (!profile?.dateOfBirth) missingInputs.push('dateOfBirth');
    if (!profile?.activityLevel) missingInputs.push('activityLevel');
    if (!profile?.heightCm) missingInputs.push('heightCm');
    if (!profile?.weightKg) missingInputs.push('weightKg');
    if (missingInputs.length) {
      return {
        status: 'INSUFFICIENT_INPUT',
        missingInputs,
        dailyTargets: null,
      };
    }

    const activityMultiplier: Record<string, number> = {
      SEDENTARY: 1.2,
      LIGHT: 1.375,
      MODERATE: 1.55,
      ACTIVE: 1.725,
      VERY_ACTIVE: 1.9,
    };
    const age =
      new Date().getFullYear() - new Date(profile!.dateOfBirth!).getFullYear();
    const weight = profile!.weightKg!;
    const height = profile!.heightCm!;
    const isMale = profile!.gender === 'MALE';
    const bmr = isMale
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161;
    const multiplier =
      activityMultiplier[profile!.activityLevel ?? 'MODERATE'] ?? 1.55;
    const energyKcal = Math.round(bmr * multiplier);
    const proteinG = Math.round(weight * 1.6);
    const fatG = Math.round((energyKcal * 0.25) / 9);
    const carbsG = Math.round((energyKcal - proteinG * 4 - fatG * 9) / 4);

    const existing = await (this.prisma.db as any).healthTarget.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    const data = {
      mode: 'SYSTEM_ESTIMATED',
      energyKcal,
      proteinG,
      carbsG,
      fatG,
      waterMl: 2000,
      steps: 8000,
    };

    const target = existing
      ? await (this.prisma.db as any).healthTarget.update({
          where: { id: existing.id },
          data: { ...data, version: { increment: 1 } },
        })
      : await (this.prisma.db as any).healthTarget.create({
          data: { userId, ...data, version: 1 },
        });

    return {
      status: 'AVAILABLE',
      method: 'MIFFLIN_ST_JEOR_V1',
      formulaVersion: '1.0',
      dailyTargets: {
        energyKcal: target.energyKcal,
        proteinG: target.proteinG,
        carbsG: target.carbsG,
        fatG: target.fatG,
        waterMl: target.waterMl,
        steps: target.steps,
        mode: target.mode,
        version: target.version,
      },
    };
  }

  async updateHealthTarget(userId: string, dto: UpdateHealthTargetDto, ifMatch?: string) {
    if (!ifMatch) {
      throw new PreconditionFailedException({
        error: { code: 'PRECONDITION_REQUIRED', message: 'Thiếu header If-Match.' },
      });
    }

    const cleanVer = ifMatch.replace(/"/g, '').trim();
    const expectedVer = parseInt(cleanVer, 10);

    const existing = await (this.prisma.db as any).healthTarget.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    if (!existing) {
      throw new NotFoundException({
        error: { code: 'TARGET_NOT_FOUND', message: 'Không tìm thấy mục tiêu sức khỏe.' },
      });
    }

    if (isNaN(expectedVer) || existing.version !== expectedVer) {
      throw new ConflictException({
        error: {
          code: 'HEALTH_TARGET_VERSION_CONFLICT',
          message: 'Mục tiêu sức khỏe đã được thay đổi ở nơi khác.',
          details: { expectedVersion: existing.version },
        },
      });
    }

    const updated = await (this.prisma.db as any).healthTarget.update({
      where: { id: existing.id },
      data: {
        ...(dto.mode ? { mode: dto.mode } : {}),
        ...(dto.energyKcal !== undefined ? { energyKcal: dto.energyKcal } : {}),
        ...(dto.proteinG !== undefined ? { proteinG: dto.proteinG } : {}),
        ...(dto.carbsG !== undefined ? { carbsG: dto.carbsG } : {}),
        ...(dto.fatG !== undefined ? { fatG: dto.fatG } : {}),
        ...(dto.waterMl !== undefined ? { waterMl: dto.waterMl } : {}),
        ...(dto.steps !== undefined ? { steps: dto.steps } : {}),
        version: { increment: 1 },
      },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      mode: updated.mode,
      energyKcal: updated.energyKcal,
      proteinG: updated.proteinG,
      carbsG: updated.carbsG,
      fatG: updated.fatG,
      waterMl: updated.waterMl,
      steps: updated.steps,
      version: updated.version,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteMeasurement(userId: string, id: string) {
    const existing = await (this.prisma.db as any).profileMeasurement.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException({
        error: { code: 'MEASUREMENT_NOT_FOUND', message: 'Không tìm thấy chỉ số.' },
      });
    }
    await (this.prisma.db as any).profileMeasurement.delete({ where: { id } });
    return { deleted: true };
  }

  async syncActivity(
    userId: string,
    dto: {
      provider: string;
      buckets: Array<{
        type: string;
        startAt: string;
        endAt: string;
        value: number;
        dedupeKey?: string;
      }>;
    },
  ) {
    let upserted = 0;
    for (const b of dto.buckets ?? []) {
      const dedupeKey = b.dedupeKey ?? `${b.type}:${b.startAt}:${b.endAt}`;
      try {
        await (this.prisma.db as any).activityBucket.upsert({
          where: {
            userId_provider_type_startAt_endAt_dedupeKey: {
              userId,
              provider: dto.provider,
              type: b.type,
              startAt: new Date(b.startAt),
              endAt: new Date(b.endAt),
              dedupeKey,
            },
          },
          create: {
            userId,
            provider: dto.provider,
            type: b.type,
            startAt: new Date(b.startAt),
            endAt: new Date(b.endAt),
            value: b.value,
            dedupeKey,
          },
          update: {
            value: b.value,
            syncedAt: new Date(),
          },
        });
        upserted += 1;
      } catch {
        // Fallback create-only if unique composite naming differs
        await (this.prisma.db as any).activityBucket.create({
          data: {
            userId,
            provider: dto.provider,
            type: b.type,
            startAt: new Date(b.startAt),
            endAt: new Date(b.endAt),
            value: b.value,
            dedupeKey,
          },
        }).catch(() => null);
      }
    }
    return { upserted, provider: dto.provider };
  }
}
