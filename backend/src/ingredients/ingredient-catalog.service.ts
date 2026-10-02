import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  IngredientCreatedVia,
  IngredientImageStatus,
  IngredientStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IngredientNormalizerService } from './ingredient-normalizer.service';
import {
  CatalogIngredientResolverService,
  CatalogResolveInput,
  CatalogResolveItemResult,
  CatalogResolveOutcome,
} from './ingredient-resolver.service';
import { IngredientEnrichmentQueue } from './ingredient-enrichment.queue';

export interface ResolveOrProvisionOptions {
  createMissing?: boolean;
  /**
   * Mặc định false: item có ứng viên gần giống (AMBIGUOUS) KHÔNG được tạo mới
   * để tránh sinh bản ghi trùng; caller (AI import) phân xử trước rồi gọi lại
   * với `true` cho các item đã được xác nhận là nguyên liệu khác.
   */
  createAmbiguous?: boolean;
  enqueueImageEnrichment?: boolean;
  createdVia?: IngredientCreatedVia;
}

export interface ResolveOrProvisionInput extends CatalogResolveInput {
  /**
   * Nguyên liệu đã được xác định sẵn (ví dụ AI phân xử "chân giò heo" = "giò heo").
   * Khi có, bỏ qua resolve và link thẳng; `rawName` được ghi thêm vào synonyms
   * của nguyên liệu đích để các lần sau khớp deterministic.
   */
  preResolvedIngredientId?: string | null;
  preResolvedConfidence?: number;
}

export interface ResolveOrProvisionBatchResult {
  items: Array<
    CatalogResolveItemResult & {
      imageStatus?: IngredientImageStatus;
      enrichmentQueued?: boolean;
    }
  >;
  createdIds: string[];
  byClientRef: Map<string, CatalogResolveItemResult>;
}

@Injectable()
export class IngredientCatalogService {
  private readonly logger = new Logger(IngredientCatalogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly normalizer: IngredientNormalizerService,
    private readonly resolver: CatalogIngredientResolverService,
    private readonly enrichmentQueue: IngredientEnrichmentQueue,
  ) {}

  async resolveOrProvisionBatch(
    inputs: ResolveOrProvisionInput[],
    options: ResolveOrProvisionOptions = {},
  ): Promise<ResolveOrProvisionBatchResult> {
    const createMissing = options.createMissing ?? true;
    const createAmbiguous = options.createAmbiguous ?? false;
    const enqueueImage = options.enqueueImageEnrichment ?? true;
    const createdVia = options.createdVia ?? IngredientCreatedVia.MANUAL;
    const capped = inputs.slice(0, 100);

    // Item đã có link sẵn (AI phân xử / admin chọn) → không resolve lại.
    const preResolved = capped.filter((i) => i.preResolvedIngredientId);
    const toResolve = capped.filter((i) => !i.preResolvedIngredientId);

    const resolved = toResolve.length
      ? await this.resolver.resolveExistingBatch(toResolve)
      : new Map<string, CatalogResolveItemResult>();

    if (preResolved.length) {
      const ids = [
        ...new Set(preResolved.map((i) => i.preResolvedIngredientId!)),
      ];
      const targets = await this.prisma.db.ingredient.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, synonyms: true, status: true },
      });
      const byId = new Map(targets.map((t) => [t.id, t]));
      const synonymAppend = new Map<string, Set<string>>();
      for (const item of preResolved) {
        const target = byId.get(item.preResolvedIngredientId!);
        const identity = this.normalizer.identityKey(item.rawName);
        if (!target) {
          // id không còn tồn tại → resolve như bình thường ở vòng sau.
          resolved.set(item.clientRef, {
            clientRef: item.clientRef,
            inputKey: identity,
            outcome: 'INVALID',
            ingredientId: null,
            canonicalName:
              this.normalizer.cleanDisplayName(item.rawName) || null,
            isNew: false,
            confidence: 0,
            candidates: [],
          });
          continue;
        }
        resolved.set(item.clientRef, {
          clientRef: item.clientRef,
          inputKey: identity,
          outcome: 'EXISTING_SYNONYM',
          ingredientId: target.id,
          canonicalName: target.name,
          isNew: false,
          confidence: item.preResolvedConfidence ?? 90,
          candidates: [],
        });
        // Học lại: ghi tên đầu vào vào synonyms của đích nếu chưa có.
        const display = this.normalizer.cleanDisplayName(item.rawName);
        const known = new Set(
          [target.name, ...(target.synonyms ?? [])].map((s) =>
            this.normalizer.identityKey(s),
          ),
        );
        if (display && !known.has(identity)) {
          const set = synonymAppend.get(target.id) ?? new Set<string>();
          set.add(display);
          synonymAppend.set(target.id, set);
        }
      }
      if (synonymAppend.size) {
        await this.learnSynonyms(
          [...synonymAppend].map(([id, set]) => ({ id, synonyms: [...set] })),
        ).catch((err) =>
          this.logger.warn(
            `learnSynonyms (preResolved) failed: ${(err as Error).message}`,
          ),
        );
      }
    }

    const createdIds: string[] = [];
    const pendingCreateByIdentity = new Map<
      string,
      { clientRefs: string[]; unit?: string; displayName: string }
    >();

    for (const item of capped) {
      const current = resolved.get(item.clientRef);
      if (!current || current.ingredientId) continue;
      if (current.outcome === 'AMBIGUOUS' && !createAmbiguous) continue;
      if (current.outcome === 'INVALID' && !current.inputKey) {
        continue;
      }
      if (!createMissing) {
        continue;
      }

      const identity =
        current.inputKey || this.normalizer.identityKey(item.rawName);
      if (!identity) continue;

      const existingGroup = pendingCreateByIdentity.get(identity);
      if (existingGroup) {
        existingGroup.clientRefs.push(item.clientRef);
      } else {
        pendingCreateByIdentity.set(identity, {
          clientRefs: [item.clientRef],
          unit: item.unit,
          displayName:
            this.normalizer.cleanDisplayName(item.rawName) ||
            item.rawName.trim(),
        });
      }
    }

    for (const [identity, group] of pendingCreateByIdentity) {
      const provisioned = await this.provisionOne(
        identity,
        group.displayName,
        group.unit,
        createdVia,
      );
      if (provisioned.isNew) createdIds.push(provisioned.id);

      for (const clientRef of group.clientRefs) {
        const previous = resolved.get(clientRef);
        resolved.set(clientRef, {
          clientRef,
          inputKey: identity,
          outcome: provisioned.isNew ? 'CREATED_PENDING' : 'EXISTING_EXACT',
          ingredientId: provisioned.id,
          canonicalName: provisioned.name,
          isNew: provisioned.isNew,
          confidence: provisioned.isNew ? 80 : 100,
          // Giữ ứng viên gần giống để admin có thể gộp nhanh khi duyệt.
          candidates: provisioned.isNew ? (previous?.candidates ?? []) : [],
        });
      }
    }

    if (enqueueImage && createdIds.length) {
      const queued =
        await this.enrichmentQueue.enqueueNewIngredients(createdIds);
      this.logger.log(
        `Image enrichment queued=${queued}/${createdIds.length} (bull=${this.enrichmentQueue.enabled})`,
      );
    }

    const items = capped.map((item) => {
      const hit =
        resolved.get(item.clientRef) ??
        ({
          clientRef: item.clientRef,
          inputKey: '',
          outcome: 'INVALID' as CatalogResolveOutcome,
          ingredientId: null,
          canonicalName: null,
          isNew: false,
          confidence: 0,
          candidates: [],
        } satisfies CatalogResolveItemResult);
      return {
        ...hit,
        imageStatus: hit.isNew
          ? IngredientImageStatus.QUEUED
          : hit.ingredientId
            ? undefined
            : IngredientImageStatus.NOT_REQUESTED,
        enrichmentQueued: Boolean(hit.isNew && enqueueImage),
      };
    });

    this.logger.log(
      `resolveOrProvisionBatch: ${items.length} items, created=${createdIds.length}`,
    );

    return {
      items,
      createdIds,
      byClientRef: new Map(
        items.map((i) => {
          const { imageStatus: _is, enrichmentQueued: _eq, ...base } = i;
          return [i.clientRef, base];
        }),
      ),
    };
  }

  /**
   * Học synonyms cho các nguyên liệu (từ AI gợi ý hoặc admin). Bỏ qua synonym
   * trùng với identity của nguyên liệu khác đang có trong kho để tránh gây
   * nhầm lẫn giữa hai bản ghi.
   */
  async learnSynonyms(
    entries: Array<{ id: string; synonyms: string[] }>,
  ): Promise<void> {
    const ids = [...new Set(entries.map((e) => e.id))];
    if (!ids.length) return;
    const targets = await this.prisma.db.ingredient.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, synonyms: true },
    });
    const byId = new Map(targets.map((t) => [t.id, t]));

    const proposed = new Set<string>();
    for (const e of entries)
      for (const s of e.synonyms) proposed.add(this.normalizer.identityKey(s));
    const conflicts = await this.prisma.db.ingredient.findMany({
      where: {
        identityNormalized: { in: [...proposed].filter(Boolean) },
        status: { notIn: [IngredientStatus.REJECTED, IngredientStatus.MERGED] },
      },
      select: { identityNormalized: true },
    });
    const taken = new Set(conflicts.map((c) => c.identityNormalized));

    const additions = new Map<string, Set<string>>();
    for (const e of entries) {
      const set = additions.get(e.id) ?? new Set<string>();
      for (const s of e.synonyms) {
        const key = this.normalizer.identityKey(s);
        if (!key || taken.has(key)) continue;
        set.add(this.normalizer.cleanDisplayName(s));
      }
      additions.set(e.id, set);
    }
    await this.appendSynonyms(additions, byId);
  }

  /** Ghi thêm synonyms (dedupe theo identityKey) để lần import sau khớp ở L1. */
  private async appendSynonyms(
    additions: Map<string, Set<string>>,
    byId: Map<string, { id: string; name: string; synonyms: string[] }>,
  ) {
    for (const [id, names] of additions) {
      const target = byId.get(id);
      if (!target || !names.size) continue;
      const seen = new Set(
        [target.name, ...(target.synonyms ?? [])].map((s) =>
          this.normalizer.identityKey(s),
        ),
      );
      const merged = [...(target.synonyms ?? [])];
      for (const n of names) {
        const key = this.normalizer.identityKey(n);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push(n.substring(0, 98));
      }
      if (merged.length === (target.synonyms ?? []).length) continue;
      try {
        await this.prisma.db.ingredient.update({
          where: { id },
          data: { synonyms: merged, version: { increment: 1 } },
        });
        this.logger.log(
          `Synonym learned for "${target.name}": +${[...names].join(', ')}`,
        );
      } catch (err) {
        this.logger.warn(
          `appendSynonyms failed for ${id}: ${(err as Error).message}`,
        );
      }
    }
  }

  private async provisionOne(
    identity: string,
    displayName: string,
    unit?: string,
    createdVia: IngredientCreatedVia = IngredientCreatedVia.MANUAL,
  ): Promise<{ id: string; name: string; isNew: boolean }> {
    const safeName = displayName.substring(0, 198);
    const folded = this.normalizer.searchFolded(safeName);
    const code = this.normalizer.slugCode(safeName);

    try {
      const created = await this.prisma.db.ingredient.create({
        data: {
          name: safeName,
          code,
          identityNormalized: identity,
          searchFolded: folded,
          unit: unit ? unit.substring(0, 48) : null,
          status: IngredientStatus.PENDING_REVIEW,
          isActive: false,
          createdVia,
          imageStatus: IngredientImageStatus.QUEUED,
          synonyms: [],
        },
        select: { id: true, name: true },
      });
      return { id: created.id, name: created.name, isNew: true };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const existing = await this.prisma.db.ingredient.findUnique({
          where: { identityNormalized: identity },
          select: { id: true, name: true },
        });
        if (existing) {
          return { id: existing.id, name: existing.name, isNew: false };
        }
      }
      this.logger.warn(
        `provisionOne failed for "${identity}": ${(err as Error).message}`,
      );
      throw err;
    }
  }

  async approveIngredient(
    id: string,
    patch?: {
      name?: string;
      nameEn?: string;
      description?: string;
      groupLabel?: string;
      unit?: string;
      allergenCode?: string | null;
      synonyms?: string[];
      imageCandidateId?: string;
    },
  ) {
    const existing = await this.prisma.db.ingredient.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException({
        error: {
          code: 'INGREDIENT_NOT_FOUND',
          message: 'Không tìm thấy nguyên liệu.',
        },
      });
    }

    let imageStatus = existing.imageStatus;
    let imageUrl = existing.imageUrl;
    let imageKey = existing.imageKey;

    if (patch?.imageCandidateId) {
      const candidate = await this.prisma.db.ingredientImageCandidate.findFirst(
        {
          where: { id: patch.imageCandidateId, ingredientId: id },
        },
      );
      if (candidate) {
        imageKey = candidate.storageKey ?? imageKey;
        imageUrl = candidate.storageKey
          ? `${process.env.SUPABASE_URL || ''}/storage/v1/object/public/ingredient-images/${candidate.storageKey}`
          : candidate.previewUrl || candidate.originalUrl;
        imageStatus = IngredientImageStatus.APPROVED;
        await this.prisma.db.ingredientImageCandidate.update({
          where: { id: candidate.id },
          data: { status: 'APPROVED' },
        });
      }
    } else if (
      imageUrl &&
      imageStatus === IngredientImageStatus.PENDING_REVIEW
    ) {
      imageStatus = IngredientImageStatus.APPROVED;
    }

    const name = patch?.name?.trim();
    return this.prisma.db.ingredient.update({
      where: { id },
      data: {
        status: IngredientStatus.ACTIVE,
        isActive: true,
        version: { increment: 1 },
        ...(name
          ? {
              name,
              identityNormalized: this.normalizer.identityKey(name),
              searchFolded: this.normalizer.searchFolded(name),
            }
          : {}),
        ...(patch?.nameEn !== undefined ? { nameEn: patch.nameEn } : {}),
        ...(patch?.description !== undefined
          ? { description: patch.description }
          : {}),
        ...(patch?.groupLabel !== undefined
          ? { groupLabel: patch.groupLabel }
          : {}),
        ...(patch?.unit !== undefined ? { unit: patch.unit } : {}),
        ...(patch?.allergenCode !== undefined
          ? { allergenCode: patch.allergenCode }
          : {}),
        ...(patch?.synonyms !== undefined ? { synonyms: patch.synonyms } : {}),
        imageStatus,
        imageUrl,
        imageKey,
      },
    });
  }

  async mergeIngredient(id: string, targetId: string) {
    if (id === targetId) {
      throw new BadRequestException({
        error: {
          code: 'CANNOT_MERGE_SAME_INGREDIENT',
          message: 'Không thể gộp nguyên liệu vào chính nó.',
        },
      });
    }

    const [source, target] = await Promise.all([
      this.prisma.db.ingredient.findUnique({ where: { id } }),
      this.prisma.db.ingredient.findUnique({ where: { id: targetId } }),
    ]);

    if (!source || !target) {
      throw new NotFoundException({
        error: {
          code: 'INGREDIENT_NOT_FOUND',
          message: 'Không tìm thấy nguyên liệu nguồn hoặc đích.',
        },
      });
    }

    if (source.status === IngredientStatus.MERGED) {
      throw new BadRequestException({
        error: {
          code: 'ALREADY_MERGED',
          message: 'Nguyên liệu này đã được gộp trước đó.',
        },
      });
    }

    return this.prisma.db.$transaction(async (tx) => {
      const redirected = await tx.dishIngredient.updateMany({
        where: { ingredientId: id },
        data: { ingredientId: targetId },
      });

      const updatedSynonyms = Array.from(
        new Set([...(target.synonyms ?? []), source.name]),
      );

      await tx.ingredient.update({
        where: { id: targetId },
        data: {
          synonyms: updatedSynonyms,
          version: { increment: 1 },
        },
      });

      const updatedSource = await tx.ingredient.update({
        where: { id },
        data: {
          status: IngredientStatus.MERGED,
          isActive: false,
          mergedIntoId: targetId,
          version: { increment: 1 },
        },
      });

      return {
        source: updatedSource,
        target,
        redirectedDishesCount: redirected.count,
      };
    });
  }

  async findUnapprovedForDish(dishId: string) {
    const dishIngredients = await this.prisma.db.dishIngredient.findMany({
      where: { dishId },
      include: {
        ingredient: {
          select: {
            id: true,
            name: true,
            nameEn: true,
            description: true,
            groupLabel: true,
            unit: true,
            allergenCode: true,
            imageUrl: true,
            imageStatus: true,
            status: true,
            createdVia: true,
            synonyms: true,
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return dishIngredients
      .filter(
        (row) =>
          !row.ingredientId ||
          !row.ingredient ||
          row.ingredient.status !== IngredientStatus.ACTIVE,
      )
      .map((row) => {
        let reason:
          'UNLINKED' | 'PENDING_REVIEW' | 'REJECTED' | 'MERGED' | 'INACTIVE';
        if (!row.ingredientId || !row.ingredient) {
          reason = 'UNLINKED';
        } else {
          reason = row.ingredient.status as any;
        }

        return {
          dishIngredientId: row.id,
          rawText: row.rawText,
          parsedName: row.parsedName,
          quantity: row.quantity?.toString() ?? null,
          unit: row.unit,
          ingredientId: row.ingredientId,
          name: row.ingredient?.name ?? row.parsedName ?? row.rawText,
          status: row.ingredient?.status ?? null,
          imageUrl: row.ingredient?.imageUrl ?? null,
          imageStatus: row.ingredient?.imageStatus ?? null,
          createdVia: row.ingredient?.createdVia ?? null,
          ingredient: row.ingredient,
          reason,
        };
      });
  }

  async rejectIngredient(id: string) {
    return this.prisma.db.ingredient.update({
      where: { id },
      data: {
        status: IngredientStatus.REJECTED,
        isActive: false,
        version: { increment: 1 },
      },
    });
  }
}
