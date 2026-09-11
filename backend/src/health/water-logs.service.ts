import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWaterLogDto } from './dto/health.dto';

function localDateInTz(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

@Injectable()
export class WaterLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateWaterLogDto) {
    if (dto.amountMl < 1 || dto.amountMl > 3000) {
      throw new BadRequestException({ error: { code: 'INVALID_WATER_AMOUNT' } });
    }
    const timezone = dto.timezone || 'Asia/Ho_Chi_Minh';
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
    const localDateStr = dto.localDate || localDateInTz(occurredAt, timezone);

    if (dto.idempotencyKey) {
      const existing = await this.prisma.db.waterLog.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existing) return this.format(existing);
    }

    const created = await this.prisma.db.waterLog.create({
      data: {
        userId,
        amountMl: dto.amountMl,
        occurredAt,
        localDate: new Date(`${localDateStr}T00:00:00.000Z`),
        timezone,
        source: 'MANUAL',
        idempotencyKey: dto.idempotencyKey ?? null,
      },
    });
    return this.format(created);
  }

  async list(userId: string, localDate: string) {
    const items = await this.prisma.db.waterLog.findMany({
      where: {
        userId,
        localDate: new Date(`${localDate}T00:00:00.000Z`),
      },
      orderBy: { occurredAt: 'asc' },
    });
    const totalMl = items.reduce((s, i) => s + i.amountMl, 0);
    return { items: items.map((i) => this.format(i)), totalMl };
  }

  async remove(userId: string, id: string) {
    const row = await this.prisma.db.waterLog.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException({ error: { code: 'WATER_LOG_NOT_FOUND' } });
    await this.prisma.db.waterLog.delete({ where: { id } });
    return { deleted: true };
  }

  private format(row: any) {
    return {
      id: row.id,
      amountMl: row.amountMl,
      occurredAt: row.occurredAt,
      localDate: row.localDate?.toISOString?.().slice(0, 10) ?? row.localDate,
      timezone: row.timezone,
      source: row.source,
    };
  }
}
