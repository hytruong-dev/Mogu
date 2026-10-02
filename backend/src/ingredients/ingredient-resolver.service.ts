import { Injectable, Logger } from '@nestjs/common';
import { IngredientStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IngredientNormalizerService } from './ingredient-normalizer.service';

export type CatalogResolveOutcome =
  | 'EXISTING_EXACT'
  | 'EXISTING_SYNONYM'
  | 'EXISTING_NORMALIZED'
  | 'CREATED_PENDING'
  | 'AMBIGUOUS'
  | 'INVALID';

export interface CatalogResolveInput {
  clientRef: string;
  rawName: string;
  unit?: string;
  /** Bỏ qua các id này khi so khớp (dùng cho dọn trùng: không tự khớp chính mình). */
  excludeIds?: string[];
}

export type CatalogCandidateReason =
  'FOLD' | 'CANONICAL' | 'CORE' | 'CONTAINMENT' | 'TRIGRAM' | 'LEVENSHTEIN';

export interface CatalogCandidate {
  id: string;
  name: string;
  status: IngredientStatus;
  score: number;
  reason?: CatalogCandidateReason;
  synonyms?: string[];
}

export interface CatalogResolveItemResult {
  clientRef: string;
  inputKey: string;
  outcome: CatalogResolveOutcome;
  ingredientId: string | null;
  canonicalName: string | null;
  isNew: boolean;
  /** 0..100 — độ tin cậy của link (nếu có). */
  confidence?: number;
  candidates: CatalogCandidate[];
}

interface CatalogRow {
  id: string;
  name: string;
  status: IngredientStatus;
  identityNormalized: string;
  searchFolded: string;
  synonyms: string[];
}

interface TrigramRow {
  id: string;
  name: string;
  status: IngredientStatus;
  search_folded: string;
  synonyms: string[];
  sim: number;
}

/** Trạng thái được phép link tới (không link vào REJECTED/MERGED). */
const LINKABLE: IngredientStatus[] = [
  IngredientStatus.ACTIVE,
  IngredientStatus.PENDING_REVIEW,
];

const TRIGRAM_THRESHOLD = 0.42;

@Injectable()
export class CatalogIngredientResolverService {
  private readonly logger = new Logger(CatalogIngredientResolverService.name);
  private trigramAvailable: boolean | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly normalizer: IngredientNormalizerService,
  ) {}

  /**
   * L1 (deterministic): identity có dấu → synonym (có dấu / không dấu) →
   * searchFolded → canonicalKey (lợn↔heo, bắp↔ngô…). Các bước này auto-link.
   *
   * L2 (heuristic): coreKey, token-containment, pg_trgm/Levenshtein — chỉ trả
   * về `candidates` xếp hạng cho Admin hoặc cho bước AI phân xử, KHÔNG auto-link.
   */
  async resolveExistingBatch(
    items: CatalogResolveInput[],
  ): Promise<Map<string, CatalogResolveItemResult>> {
    const results = new Map<string, CatalogResolveItemResult>();
    const valid: Array<CatalogResolveInput & { identity: string }> = [];

    for (const item of items) {
      const identity = this.normalizer.identityKey(item.rawName);
      if (!identity) {
        results.set(item.clientRef, this.invalid(item.clientRef, '', null));
        continue;
      }
      valid.push({ ...item, identity });
    }
    if (!valid.length) return results;

    // Tải toàn kho có thể link (kho nguyên liệu vài nghìn dòng — 1 query/batch).
    const rows: CatalogRow[] = await this.prisma.db.ingredient.findMany({
      where: { status: { in: LINKABLE } },
      select: {
        id: true,
        name: true,
        status: true,
        identityNormalized: true,
        searchFolded: true,
        synonyms: true,
      },
    });

    const byIdentity = new Map<string, CatalogRow[]>();
    const bySynonymIdentity = new Map<string, CatalogRow[]>();
    const bySynonymFold = new Map<string, CatalogRow[]>();
    const byFold = new Map<string, CatalogRow[]>();
    const byCanonical = new Map<string, CatalogRow[]>();
    const byCore = new Map<string, CatalogRow[]>();

    const push = (
      map: Map<string, CatalogRow[]>,
      key: string,
      row: CatalogRow,
    ) => {
      if (!key) return;
      const list = map.get(key);
      if (list) {
        if (!list.some((r) => r.id === row.id)) list.push(row);
      } else map.set(key, [row]);
    };

    for (const row of rows) {
      push(byIdentity, row.identityNormalized, row);
      const fold = row.searchFolded || this.normalizer.searchFolded(row.name);
      push(byFold, fold, row);
      push(byCanonical, this.normalizer.canonicalKey(row.name), row);
      push(byCore, this.normalizer.coreKey(row.name), row);
      for (const syn of row.synonyms ?? []) {
        push(bySynonymIdentity, this.normalizer.identityKey(syn), row);
        push(bySynonymFold, this.normalizer.searchFolded(syn), row);
        push(byCanonical, this.normalizer.canonicalKey(syn), row);
      }
    }

    const unresolved: typeof valid = [];
    const suspectSynonym = new Map<string, CatalogRow>();

    for (const item of valid) {
      const fold = this.normalizer.searchFolded(item.rawName);
      const canonical = this.normalizer.canonicalKey(item.rawName);
      const excluded = new Set(item.excludeIds ?? []);
      const allowed = (list?: CatalogRow[]) =>
        list?.filter((r) => !excluded.has(r.id));

      const exact = this.pickBest(allowed(byIdentity.get(item.identity)));
      if (exact) {
        results.set(
          item.clientRef,
          this.hit(item, exact, 'EXISTING_EXACT', 100),
        );
        continue;
      }

      const viaSynonym =
        this.pickBest(allowed(bySynonymIdentity.get(item.identity))) ??
        this.pickBest(allowed(bySynonymFold.get(fold)));
      if (viaSynonym) {
        // Synonyms do AI enrichment sinh có thể "nghĩa rộng" (vd "ớt" ← "ớt bột",
        // "đậu hũ chiên" ← "đậu hũ"). Nếu input và tên đích là tập cha/con chỉ khác
        // một từ bổ nghĩa ĐỔI BẢN CHẤT (score 1..89) → không auto-link, để AI phân xử.
        const c = this.normalizer.containmentScore(
          item.rawName,
          viaSynonym.name,
        );
        if (c === 0 || c >= 90) {
          results.set(
            item.clientRef,
            this.hit(item, viaSynonym, 'EXISTING_SYNONYM', 98),
          );
          continue;
        }
        suspectSynonym.set(item.clientRef, viaSynonym);
      }

      // Fold/canonical bỏ dấu nên phải xác minh dấu (cá ≠ cà, bò ≠ bơ) trước khi link.
      const viaFold = this.pickBest(
        allowed(byFold.get(fold))?.filter(
          (r) => this.normalizer.containmentScore(item.rawName, r.name) === 100,
        ),
      );
      if (viaFold) {
        results.set(
          item.clientRef,
          this.hit(item, viaFold, 'EXISTING_NORMALIZED', 96),
        );
        continue;
      }

      const viaCanonical = this.pickBest(
        allowed(byCanonical.get(canonical))?.filter((r) => {
          if (suspectSynonym.get(item.clientRef)?.id === r.id) return false;
          const direct =
            this.normalizer.containmentScore(item.rawName, r.name) === 100;
          const viaSyn = (r.synonyms ?? []).some((s) => {
            if (this.normalizer.containmentScore(item.rawName, s) !== 100)
              return false;
            // Synonym phải cùng "bản chất" với tên đích (không phải nghĩa rộng).
            const sc = this.normalizer.containmentScore(s, r.name);
            return sc === 0 || sc >= 90;
          });
          return direct || viaSyn;
        }),
      );
      if (viaCanonical) {
        results.set(
          item.clientRef,
          this.hit(item, viaCanonical, 'EXISTING_NORMALIZED', 95),
        );
        continue;
      }

      unresolved.push(item);
    }

    if (!unresolved.length) return results;

    // L2: gợi ý ứng viên (không auto-link).
    const trigram = await this.trigramCandidates(
      unresolved.map((u) => this.normalizer.searchFolded(u.rawName)),
    );

    for (const item of unresolved) {
      const fold = this.normalizer.searchFolded(item.rawName);
      const core = this.normalizer.coreKey(item.rawName);
      const excluded = new Set(item.excludeIds ?? []);
      const scored = new Map<string, CatalogCandidate>();
      const offer = (
        row: CatalogRow | TrigramRow,
        score: number,
        reason: CatalogCandidateReason,
      ) => {
        if (excluded.has(row.id)) return;
        const prev = scored.get(row.id);
        if (prev && prev.score >= score) return;
        scored.set(row.id, {
          id: row.id,
          name: row.name,
          status: row.status,
          score,
          reason,
          synonyms: row.synonyms,
        });
      };

      const suspect = suspectSynonym.get(item.clientRef);
      if (suspect) offer(suspect, 88, 'CORE');

      for (const row of byCore.get(core) ?? []) offer(row, 90, 'CORE');

      // Token containment: quét các dòng chia sẻ ít nhất 1 token core.
      const inputTokens = new Set(core.split(' ').filter(Boolean));
      if (inputTokens.size) {
        for (const row of rows) {
          const rowCore = this.normalizer.coreKey(row.name);
          if (!rowCore) continue;
          const shares = rowCore.split(' ').some((t) => inputTokens.has(t));
          if (!shares) continue;
          const c = this.normalizer.containmentScore(item.rawName, row.name);
          if (c >= 60) offer(row, Math.min(c, 92), 'CONTAINMENT');
        }
      }

      for (const row of trigram.get(fold) ?? []) {
        offer(row, Math.round(row.sim * 100), 'TRIGRAM');
      }

      if (!trigram.size) {
        // Fallback khi pg_trgm chưa bật: Levenshtein trên canonical key.
        for (const row of rows) {
          const sim = this.normalizer.similarity(item.rawName, row.name);
          if (sim >= 0.72) offer(row, Math.round(sim * 100), 'LEVENSHTEIN');
        }
      }

      const candidates = [...scored.values()]
        .sort(
          (a, b) =>
            b.score - a.score ||
            (a.status === IngredientStatus.ACTIVE ? -1 : 1),
        )
        .slice(0, 5);

      results.set(item.clientRef, {
        clientRef: item.clientRef,
        inputKey: item.identity,
        outcome:
          candidates.length > 0 && candidates[0].score >= 80
            ? 'AMBIGUOUS'
            : 'INVALID',
        ingredientId: null,
        canonicalName: this.normalizer.cleanDisplayName(item.rawName) || null,
        isNew: false,
        confidence: candidates[0]?.score ?? 0,
        candidates,
      });
    }

    return results;
  }

  private pickBest(list?: CatalogRow[]): CatalogRow | undefined {
    if (!list?.length) return undefined;
    return list.find((r) => r.status === IngredientStatus.ACTIVE) ?? list[0];
  }

  private hit(
    item: CatalogResolveInput & { identity: string },
    row: CatalogRow,
    outcome: CatalogResolveOutcome,
    confidence: number,
  ): CatalogResolveItemResult {
    return {
      clientRef: item.clientRef,
      inputKey: item.identity,
      outcome,
      ingredientId: row.id,
      canonicalName: row.name,
      isNew: false,
      confidence,
      candidates: [],
    };
  }

  private invalid(
    clientRef: string,
    inputKey: string,
    canonicalName: string | null,
  ): CatalogResolveItemResult {
    return {
      clientRef,
      inputKey,
      outcome: 'INVALID',
      ingredientId: null,
      canonicalName,
      isNew: false,
      confidence: 0,
      candidates: [],
    };
  }

  /**
   * Ứng viên gần giống qua pg_trgm (similarity trên search_folded). Trả về map
   * fold → rows. Nếu extension chưa có, trả map rỗng để caller fallback.
   */
  private async trigramCandidates(
    folds: string[],
  ): Promise<Map<string, TrigramRow[]>> {
    const out = new Map<string, TrigramRow[]>();
    const unique = [...new Set(folds.filter(Boolean))];
    if (!unique.length || this.trigramAvailable === false) return out;

    try {
      const rows = await this.prisma.db.$queryRaw<
        Array<TrigramRow & { q: string }>
      >(Prisma.sql`
        SELECT q.q, i.id, i.name, i.status, i.search_folded, i.synonyms,
               similarity(i.search_folded, q.q)::float AS sim
        FROM unnest(${unique}::text[]) AS q(q)
        JOIN ingredients i
          ON i.status IN ('ACTIVE', 'PENDING_REVIEW')
         AND similarity(i.search_folded, q.q) >= ${TRIGRAM_THRESHOLD}
        ORDER BY q.q, sim DESC
      `);
      this.trigramAvailable = true;
      for (const row of rows) {
        const list = out.get(row.q);
        if (list) {
          if (list.length < 8) list.push(row);
        } else out.set(row.q, [row]);
      }
    } catch (err) {
      const message = (err as Error).message ?? '';
      if (/similarity|pg_trgm|does not exist/i.test(message)) {
        this.logger.warn(
          'pg_trgm chưa bật — dùng Levenshtein trong Node để gợi ý nguyên liệu.',
        );
        this.trigramAvailable = false;
      } else {
        this.logger.warn(`trigramCandidates lỗi: ${message}`);
      }
    }
    return out;
  }
}
