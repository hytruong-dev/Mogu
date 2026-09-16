import { Injectable, Logger } from '@nestjs/common';
import { IngredientImageStatus, IngredientStatus, Prisma } from '@prisma/client';
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
  enqueueImageEnrichment?: boolean;
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
    inputs: CatalogResolveInput[],
    options: ResolveOrProvisionOptions = {},
  ): Promise<ResolveOrProvisionBatchResult> {
    const createMissing = options.createMissing ?? true;
    const enqueueImage = options.enqueueImageEnrichment ?? true;
    const capped = inputs.slice(0, 100);

    const resolved = await this.resolver.resolveExistingBatch(capped);
    const createdIds: string[] = [];
    const pendingCreateByIdentity = new Map<
      string,
      { clientRefs: string[]; unit?: string; displayName: string }
    >();

    for (const item of capped) {
      const current = resolved.get(item.clientRef);
      if (!current || current.ingredientId || current.outcome === 'AMBIGUOUS') {
        continue;
      }
      if (current.outcome === 'INVALID' && !current.inputKey) {
        continue;
      }
      if (!createMissing) {
        continue;
      }

      const identity = current.inputKey || this.normalizer.identityKey(item.rawName);
      if (!identity) continue;

      const existingGroup = pendingCreateByIdentity.get(identity);
      if (existingGroup) {
        existingGroup.clientRefs.push(item.clientRef);
      } else {
        pendingCreateByIdentity.set(identity, {
          clientRefs: [item.clientRef],
          unit: item.unit,
          displayName:
            this.normalizer.cleanDisplayName(item.rawName) || item.rawName.trim(),
        });
      }
    }

    for (const [identity, group] of pendingCreateByIdentity) {
      const provisioned = await this.provisionOne(
        identity,
        group.displayName,
        group.unit,
      );
      if (provisioned.isNew) createdIds.push(provisioned.id);

      for (const clientRef of group.clientRefs) {
        resolved.set(clientRef, {
          clientRef,
          inputKey: identity,
          outcome: provisioned.isNew ? 'CREATED_PENDING' : 'EXISTING_EXACT',
          ingredientId: provisioned.id,
          canonicalName: provisioned.name,
          isNew: provisioned.isNew,
          candidates: [],
        });
      }
    }

    if (enqueueImage && createdIds.length) {
      const queued = await this.enrichmentQueue.enqueueNewIngredients(createdIds);
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

  private async provisionOne(
    identity: string,
    displayName: string,
    unit?: string,
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
    patch?: { allergenCode?: string | null; synonyms?: string[] },
  ) {
    return this.prisma.db.ingredient.update({
      where: { id },
      data: {
        status: IngredientStatus.ACTIVE,
        isActive: true,
        version: { increment: 1 },
        ...(patch?.allergenCode !== undefined
          ? { allergenCode: patch.allergenCode }
          : {}),
        ...(patch?.synonyms !== undefined ? { synonyms: patch.synonyms } : {}),
      },
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
