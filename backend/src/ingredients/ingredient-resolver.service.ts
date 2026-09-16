import { Injectable } from '@nestjs/common';
import { IngredientStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IngredientNormalizerService } from './ingredient-normalizer.service';

export type CatalogResolveOutcome =
  | 'EXISTING_EXACT'
  | 'EXISTING_SYNONYM'
  | 'CREATED_PENDING'
  | 'AMBIGUOUS'
  | 'INVALID';

export interface CatalogResolveInput {
  clientRef: string;
  rawName: string;
  unit?: string;
}

export interface CatalogCandidate {
  id: string;
  name: string;
  status: IngredientStatus;
  score: number;
}

export interface CatalogResolveItemResult {
  clientRef: string;
  inputKey: string;
  outcome: CatalogResolveOutcome;
  ingredientId: string | null;
  canonicalName: string | null;
  isNew: boolean;
  candidates: CatalogCandidate[];
}

@Injectable()
export class CatalogIngredientResolverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly normalizer: IngredientNormalizerService,
  ) {}

  /**
   * Exact identity or approved synonym only. No prefix/fuzzy auto-link.
   * Ambiguous near-matches returned as candidates (max 5) without linking.
   */
  async resolveExistingBatch(
    items: CatalogResolveInput[],
  ): Promise<Map<string, CatalogResolveItemResult>> {
    const results = new Map<string, CatalogResolveItemResult>();
    const identities = new Set<string>();
    const folded = new Set<string>();

    for (const item of items) {
      const identity = this.normalizer.identityKey(item.rawName);
      if (!identity) {
        results.set(item.clientRef, {
          clientRef: item.clientRef,
          inputKey: '',
          outcome: 'INVALID',
          ingredientId: null,
          canonicalName: null,
          isNew: false,
          candidates: [],
        });
        continue;
      }
      identities.add(identity);
      folded.add(this.normalizer.searchFolded(item.rawName));
    }

    if (!identities.size) return results;

    const identityList = [...identities];
    const foldedList = [...folded];

    const byIdentity = await this.prisma.db.ingredient.findMany({
      where: {
        identityNormalized: { in: identityList },
        status: { notIn: [IngredientStatus.REJECTED, IngredientStatus.MERGED] },
      },
      select: {
        id: true,
        name: true,
        status: true,
        identityNormalized: true,
        synonyms: true,
      },
    });

    const identityMap = new Map(
      byIdentity.map((row) => [row.identityNormalized, row]),
    );

    // Synonym scan limited to ACTIVE rows whose folded name shares a token prefix group —
    // load ACTIVE with overlapping searchFolded starts for candidate ranking only.
    const synonymCandidates = await this.prisma.db.ingredient.findMany({
      where: {
        status: IngredientStatus.ACTIVE,
        OR: [
          { searchFolded: { in: foldedList } },
          ...foldedList.slice(0, 50).map((f) => ({
            searchFolded: { startsWith: f.substring(0, Math.min(3, f.length)) },
          })),
        ],
      },
      select: {
        id: true,
        name: true,
        status: true,
        identityNormalized: true,
        synonyms: true,
        searchFolded: true,
      },
      take: 500,
    });

    const synonymByIdentity = new Map<string, (typeof synonymCandidates)[0]>();
    for (const row of synonymCandidates) {
      for (const syn of row.synonyms ?? []) {
        const key = this.normalizer.identityKey(syn);
        if (key) synonymByIdentity.set(key, row);
      }
    }

    for (const item of items) {
      if (results.has(item.clientRef)) continue;
      const identity = this.normalizer.identityKey(item.rawName);
      const fold = this.normalizer.searchFolded(item.rawName);

      const exact = identityMap.get(identity);
      if (exact) {
        results.set(item.clientRef, {
          clientRef: item.clientRef,
          inputKey: identity,
          outcome: 'EXISTING_EXACT',
          ingredientId: exact.id,
          canonicalName: exact.name,
          isNew: false,
          candidates: [],
        });
        continue;
      }

      const viaSynonym = synonymByIdentity.get(identity);
      if (viaSynonym) {
        results.set(item.clientRef, {
          clientRef: item.clientRef,
          inputKey: identity,
          outcome: 'EXISTING_SYNONYM',
          ingredientId: viaSynonym.id,
          canonicalName: viaSynonym.name,
          isNew: false,
          candidates: [],
        });
        continue;
      }

      // Near matches for Admin (never auto-link). Require shared folded token equality
      // only when fold lengths are close — never prefix-link "cá" → "cà chua".
      const near = synonymCandidates
        .filter((row) => {
          if (row.searchFolded === fold) return true;
          // Same folded length ±2 and one equals the other only if exact fold — already handled.
          // Offer suggestions if Levenshtein-ish: shared start of full fold word equality only.
          return false;
        })
        .slice(0, 5)
        .map((row) => ({
          id: row.id,
          name: row.name,
          status: row.status,
          score: row.searchFolded === fold ? 100 : 50,
        }));

      results.set(item.clientRef, {
        clientRef: item.clientRef,
        inputKey: identity,
        outcome: near.length > 1 ? 'AMBIGUOUS' : 'INVALID',
        ingredientId: null,
        canonicalName: null,
        isNew: false,
        candidates: near,
      });
      // INVALID here means "not found existing" — catalog will provision if createMissing.
      if (near.length <= 1) {
        results.set(item.clientRef, {
          clientRef: item.clientRef,
          inputKey: identity,
          outcome: 'INVALID',
          ingredientId: null,
          canonicalName: this.normalizer.cleanDisplayName(item.rawName) || null,
          isNew: false,
          candidates: near,
        });
      }
    }

    return results;
  }
}
