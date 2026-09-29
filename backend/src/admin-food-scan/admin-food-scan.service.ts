import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildDishSearchText } from '../dishes/services/dish-command.service';
import { FoodScanReportService } from '../food-scan/food-scan-report.service';
import { FoodScanEmbeddingService } from '../food-scan/food-scan-embedding.service';
import { foldFoodScanName } from '../food-scan/food-scan-matcher.service';
import {
  ListMissingDishesQueryDto,
  UpdateMissingDishDto,
} from './dto/admin-food-scan.dto';

type ReportRow = Prisma.FoodScanMissingDishReportGetPayload<{
  include: { linkedDish: { select: { id: true; name: true; slug: true } } };
}>;

@Injectable()
export class AdminFoodScanService {
  private readonly logger = new Logger(AdminFoodScanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: FoodScanReportService,
    private readonly embedding: FoodScanEmbeddingService,
  ) {}

  async summary() {
    const groups = await this.prisma.db.foodScanMissingDishReport.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const by = Object.fromEntries(groups.map((g) => [g.status, g._count._all]));
    return {
      new: by.NEW ?? 0,
      inProgress: by.IN_PROGRESS ?? 0,
      added: by.ADDED ?? 0,
      dismissed: by.DISMISSED ?? 0,
    };
  }

  async list(query: ListMissingDishesQueryDto) {
    const limit = query.limit ?? 24;
    const offset = query.offset ?? 0;
    const where: Prisma.FoodScanMissingDishReportWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? { recognizedName: { contains: query.q, mode: 'insensitive' } }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.db.foodScanMissingDishReport.count({ where }),
      this.prisma.db.foodScanMissingDishReport.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        take: limit,
        skip: offset,
        include: { linkedDish: { select: { id: true, name: true, slug: true } } },
      }),
    ]);

    const suggestedIds = [
      ...new Set(rows.flatMap((r) => this.asStringArray(r.suggestedDishIds))),
    ];
    const suggested = suggestedIds.length
      ? await this.prisma.db.dish.findMany({
          where: { id: { in: suggestedIds } },
          select: { id: true, name: true, slug: true },
        })
      : [];
    const suggestedById = new Map(suggested.map((d) => [d.id, d]));

    const items = await Promise.all(
      rows.map((r) => this.serialize(r, suggestedById)),
    );
    return { items, total, limit, offset };
  }

  async get(id: string) {
    const row = await this.prisma.db.foodScanMissingDishReport.findUnique({
      where: { id },
      include: { linkedDish: { select: { id: true, name: true, slug: true } } },
    });
    if (!row) throw new NotFoundException('FOOD_SCAN_REPORT_NOT_FOUND');
    return this.serialize(row, new Map());
  }

  async update(id: string, dto: UpdateMissingDishDto, actorId: string) {
    const before = await this.prisma.db.foodScanMissingDishReport.findUnique({
      where: { id },
    });
    if (!before) throw new NotFoundException('FOOD_SCAN_REPORT_NOT_FOUND');

    let aliasAdded = false;
    if (dto.linkedDishId) {
      const dish = await this.prisma.db.dish.findFirst({
        where: { id: dto.linkedDishId, deletedAt: null },
        select: { id: true, name: true, alternateNames: true },
      });
      if (!dish) throw new BadRequestException('FOOD_SCAN_REPORT_INVALID_DISH');
      if (dto.addAlias && before.recognizedName) {
        aliasAdded = await this.addAlias(dish, before.recognizedName);
      }
    }

    const closing = dto.status === 'ADDED' || dto.status === 'DISMISSED';
    const updated = await this.prisma.db.foodScanMissingDishReport.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.linkedDishId !== undefined
          ? { linkedDishId: dto.linkedDishId }
          : {}),
        ...(dto.adminNote !== undefined ? { adminNote: dto.adminNote } : {}),
        ...(closing || dto.status === 'IN_PROGRESS'
          ? { handledBy: actorId, handledAt: new Date() }
          : {}),
      },
      include: { linkedDish: { select: { id: true, name: true, slug: true } } },
    });

    await this.prisma.db.adminActionAudit
      .create({
        data: {
          actorUserId: actorId,
          targetType: 'FOOD_SCAN_REPORT',
          targetId: id,
          action: `FOOD_SCAN_REPORT_${dto.status ?? 'UPDATED'}`,
          beforeSanitized: {
            status: before.status,
            linkedDishId: before.linkedDishId,
          },
          afterSanitized: {
            status: updated.status,
            linkedDishId: updated.linkedDishId,
            aliasAdded,
          },
        },
      })
      .catch((e) => this.logger.warn(`Audit failed: ${e}`));

    return { ...(await this.serialize(updated, new Map())), aliasAdded };
  }

  /** Append alias, refresh search text + text embedding so future scans hit. */
  private async addAlias(
    dish: { id: string; name: string; alternateNames: string[] },
    alias: string,
  ): Promise<boolean> {
    const trimmed = alias.trim();
    const folded = foldFoodScanName(trimmed);
    if (
      !trimmed ||
      foldFoodScanName(dish.name) === folded ||
      dish.alternateNames.some((n) => foldFoodScanName(n) === folded)
    ) {
      return false;
    }
    const alternateNames = [...dish.alternateNames, trimmed];
    await this.prisma.db.dish.update({
      where: { id: dish.id },
      data: {
        alternateNames,
        searchText: buildDishSearchText(dish.name, alternateNames),
      },
    });
    // Best-effort re-embed in the background; lexical search already works.
    void this.embedding
      .embedText([dish.name, ...alternateNames].join(' '))
      .then((vec) =>
        vec && vec.length === 512
          ? this.prisma.db.$executeRaw`
              UPDATE dishes SET food_scan_text_embedding = ${`[${vec.join(',')}]`}::vector
              WHERE id = ${dish.id}::uuid`
          : null,
      )
      .catch((e) => this.logger.warn(`Re-embed dish ${dish.id} failed: ${e}`));
    return true;
  }

  private asStringArray(value: Prisma.JsonValue): string[] {
    return Array.isArray(value)
      ? value.filter((v): v is string => typeof v === 'string')
      : [];
  }

  private async serialize(
    r: ReportRow,
    suggestedById: Map<string, { id: string; name: string; slug: string }>,
  ) {
    const guesses = Array.isArray(r.guesses)
      ? (r.guesses as { nameVi?: string; nameEn?: string | null; confidence?: number }[])
      : [];
    return {
      id: r.id,
      scanEventId: r.scanEventId,
      userId: r.userId,
      imageUrl: await this.reports
        .signedImageUrl(r.imageBucket, r.imageStorageKey, 3600)
        .catch(() => null),
      recognizedName: r.recognizedName,
      guesses: guesses.map((g) => ({
        nameVi: g.nameVi ?? '',
        nameEn: g.nameEn ?? null,
        confidence: typeof g.confidence === 'number' ? g.confidence : null,
      })),
      category: r.category,
      cuisine: r.cuisine,
      visibleIngredients: this.asStringArray(r.visibleIngredients),
      suggestedDishes: this.asStringArray(r.suggestedDishIds)
        .map((id) => suggestedById.get(id))
        .filter((d): d is { id: string; name: string; slug: string } => !!d),
      source: r.source,
      status: r.status,
      reportCount: r.reportCount,
      linkedDish: r.linkedDish,
      adminNote: r.adminNote,
      handledAt: r.handledAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}
