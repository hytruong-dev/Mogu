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
    let target = await (this.prisma.db as any).healthTarget.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    if (!target) {
      target = await (this.prisma.db as any).healthTarget.create({
        data: {
          userId,
          mode: 'SYSTEM_ESTIMATED',
          energyKcal: 2000,
          proteinG: 120,
          carbsG: 225,
          fatG: 65,
          waterMl: 2000,
          steps: 8000,
          version: 1,
        },
      });
    }

    return {
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
}
