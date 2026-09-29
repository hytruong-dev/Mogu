import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { mapNutritionToPlanServing } from '../dishes/eligibility/dish-nutrition.mapper';
import {
  FoodScanCandidate,
  FoodScanEvidence,
  FoodScanExtraction,
  FoodScanResponse,
} from './dto/food-scan.dto';
import { FoodScanRetrievalService } from './food-scan-retrieval.service';
import {
  computeImagePHash,
  FoodScanEmbeddingService,
} from './food-scan-embedding.service';
import { FoodScanRerankService } from './food-scan-rerank.service';
import { FoodScanReportService } from './food-scan-report.service';

export function foldFoodScanName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const FOOD_SCAN_STOP_WORDS = new Set([
  'mon',
  'to',
  'bat',
  'dia',
  'phan',
  'suat',
  'dac biet',
  'dac san',
  'truyen thong',
  'ngon',
  'nha lam',
]);

export function stripFoodScanStopWords(folded: string): string {
  let result = folded;
  for (const stop of FOOD_SCAN_STOP_WORDS) {
    const regex = new RegExp(`(^|\\s)${stop}(\\s|$)`, 'gi');
    result = result.replace(regex, ' ');
  }
  return result.replace(/\s+/g, ' ').trim() || folded;
}

/** Precision of visible ingredients against recipe canonical ingredients. */
export function ingredientPrecision(
  visible: string[],
  recipe: string[][],
): number | null {
  const observed = [
    ...new Set(
      visible
        .map(foldFoodScanName)
        .map(stripFoodScanStopWords)
        .filter(Boolean),
    ),
  ];
  const canonical = recipe
    .map((names) =>
      new Set(
        names
          .map(foldFoodScanName)
          .map(stripFoodScanStopWords)
          .filter(Boolean),
      ),
    )
    .filter((s) => s.size);
  if (!observed.length || !canonical.length) return null;
  const matched = new Set<number>();
  let intersection = 0;
  for (const name of observed) {
    const index = canonical.findIndex(
      (names, i) =>
        !matched.has(i) &&
        (names.has(name) ||
          [...names].some((n) => n.includes(name) || name.includes(n))),
    );
    if (index >= 0) {
      matched.add(index);
      intersection++;
    }
  }
  return intersection / observed.length;
}

/** Visibility is incomplete: Jaccard is supporting evidence, never proof of absence/allergen safety. */
export function ingredientJaccard(
  visible: string[],
  recipe: string[][],
): number | null {
  const observed = [...new Set(visible.map(foldFoodScanName).filter(Boolean))];
  const canonical = recipe
    .map((names) => new Set(names.map(foldFoodScanName).filter(Boolean)))
    .filter((s) => s.size);
  if (!observed.length || !canonical.length) return null;
  const matched = new Set<number>();
  let intersection = 0;
  for (const name of observed) {
    const index = canonical.findIndex(
      (names, i) => !matched.has(i) && names.has(name),
    );
    if (index >= 0) {
      matched.add(index);
      intersection++;
    }
  }
  return intersection / (observed.length + canonical.length - intersection);
}

export function evidenceScore(
  primary: number | null,
  alternate: number | null,
  ingredient: number | null,
): number {
  const evidence = [
    [primary, 0.5],
    [alternate, 0.2],
    [ingredient, 0.3],
  ] as const;
  let total = 0;
  let weight = 0;
  for (const [value, w] of evidence) {
    if (value !== null) {
      total += Math.min(1, Math.max(0, value)) * w;
      weight += w;
    }
  }
  return weight ? total / weight : 0;
}

/**
 * Evidence-based decision. Similarity alone (CLIP image / text embeddings) always
 * finds *some* nearest dish, so it can never prove the dish is in the catalog.
 * A match needs either a strong name match, a confirmed photo (pHash), or the
 * closed-set reranker picking a candidate.
 */
export function selectFoodScanStatus(
  extraction: FoodScanExtraction,
  candidates: FoodScanCandidate[],
  evidence?: FoodScanEvidence,
): FoodScanResponse['status'] {
  if (!extraction.isFood) return 'NOT_FOOD';
  const top = candidates[0];
  if (!top) return 'NO_MATCH';
  if (evidence && !evidence.topIsPhash) {
    const strongName = evidence.topLexicalScore >= 0.95;
    // Reranker looked at the photo and said none of the candidates is this dish.
    if (evidence.rerankRan && evidence.rerankBestIndex === null && !strongName) {
      return 'UNKNOWN_DISH';
    }
    // No reranker verdict and only visual/embedding similarity: cannot confirm.
    if (!evidence.rerankRan && evidence.topLexicalScore < 0.6) {
      return 'UNKNOWN_DISH';
    }
  }
  if (top.score < 0.5) return evidence ? 'UNKNOWN_DISH' : 'NO_MATCH';
  const margin = top.score - (candidates[1]?.score ?? 0);
  return extraction.quality === 'GOOD' &&
    top.score >= 0.70 &&
    margin >= 0.10
    ? 'MATCHED'
    : 'SUGGESTIONS';
}

/** For UNKNOWN_DISH keep at most 3 faint "maybe you meant" suggestions. */
export function capUnknownDishCandidates(
  candidates: FoodScanCandidate[],
): FoodScanCandidate[] {
  return candidates.slice(0, 3).map((c) => ({
    ...c,
    score: Math.min(c.score, 0.45),
    confidenceLabel: 'LOW' as const,
  }));
}

@Injectable()
export class FoodScanMatcherService {
  private readonly logger = new Logger(FoodScanMatcherService.name);
  private readonly retrieval: FoodScanRetrievalService;
  private readonly embedding: FoodScanEmbeddingService;
  private readonly rerank: FoodScanRerankService;
  private readonly reports: FoodScanReportService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    retrieval?: FoodScanRetrievalService,
    embedding?: FoodScanEmbeddingService,
    rerank?: FoodScanRerankService,
    reports?: FoodScanReportService,
  ) {
    this.retrieval = retrieval ?? new FoodScanRetrievalService(prisma);
    this.embedding = embedding ?? new FoodScanEmbeddingService(config);
    this.rerank = rerank ?? new FoodScanRerankService(config);
    this.reports = reports ?? new FoodScanReportService(prisma, config);
  }

  /** Auto-queue a food photo the catalog could not match (best-effort). */
  private async autoReport(
    scanId: string,
    userId: string | undefined,
    image: Buffer | undefined,
    imagePhash: string | null,
    extraction: FoodScanExtraction,
    suggestedDishIds: string[],
  ): Promise<string | undefined> {
    const report = await this.reports.createOrBump({
      scanEventId: scanId,
      userId: userId ?? null,
      image: image ?? null,
      imagePhash,
      extraction,
      suggestedDishIds,
      source: 'AUTO',
    });
    return report?.id;
  }

  /**
   * User tapped "Món này chưa có trong Mogu": mark the scan as wrong and queue it.
   * One report per scan; a repeated tap just returns the same report.
   */
  async reportMissing(
    scanId: string,
    userId: string | undefined,
    image: Buffer | null,
  ): Promise<{ success: boolean; scanId: string; reportId: string | null }> {
    const event = await this.prisma.db.foodScanEvent.findUnique({
      where: { id: scanId },
    });
    if (!event || (event.userId && userId && event.userId !== userId)) {
      throw new NotFoundException(`Food scan event ${scanId} not found`);
    }
    await this.prisma.db.foodScanEvent.update({
      where: { id: scanId },
      data: { correct: false, chosenDishId: null, confirmedAt: new Date() },
    });
    const shortlist = Array.isArray(event.shortlist)
      ? (event.shortlist as { dishId?: string }[])
      : [];
    const report = await this.reports.createOrBump({
      scanEventId: scanId,
      userId: userId ?? event.userId,
      image,
      imagePhash: event.imagePhash,
      extraction: (event.extraction as unknown as FoodScanExtraction) ?? null,
      suggestedDishIds: shortlist
        .map((s) => s.dishId)
        .filter((id): id is string => typeof id === 'string')
        .slice(0, 3),
      source: 'USER',
    });
    return { success: Boolean(report?.id), scanId, reportId: report?.id ?? null };
  }

  async match(
    extraction: FoodScanExtraction,
    model: string,
    image?: Buffer,
    userId?: string,
  ): Promise<FoodScanResponse> {
    const scanId = randomUUID();
    const startTime = Date.now();

    const response: FoodScanResponse = {
      scanId,
      status: 'NO_MATCH',
      recognizedName: extraction.primaryName,
      confidence: 0,
      candidates: [],
      model,
    };

    if (!extraction.isFood) {
      return { ...response, status: 'NOT_FOOD', recognizedName: null };
    }

    const primary = extraction.primaryName
      ? foldFoodScanName(extraction.primaryName)
      : '';
    const primaryClean = stripFoodScanStopWords(primary);
    const alternate = extraction.alternateNames
      .map(foldFoodScanName)
      .filter(Boolean);
    const guessTerms = (extraction.guesses ?? []).flatMap((g) => [
      foldFoodScanName(g.nameVi),
      stripFoodScanStopWords(foldFoodScanName(g.nameVi)),
      g.nameEn ? foldFoodScanName(g.nameEn) : '',
    ]).filter(Boolean);

    const terms = [
      ...new Set(
        [primary, primaryClean, ...alternate, ...guessTerms].filter(Boolean),
      ),
    ];

    // Compute embeddings & pHash concurrently
    let queryTextVec: number[] | null = null;
    let queryImgVec: number[] | null = null;
    let imagePhash: string | null = null;

    const queryText =
      extraction.primaryName || extraction.guesses?.[0]?.nameVi || '';

    const [textVecRes, imgVecRes, phashRes] = await Promise.allSettled([
      queryText ? this.embedding.embedText(queryText) : Promise.resolve(null),
      image ? this.embedding.embedImage(image) : Promise.resolve(null),
      image ? computeImagePHash(image) : Promise.resolve(null),
    ]);

    if (textVecRes.status === 'fulfilled') queryTextVec = textVecRes.value;
    if (imgVecRes.status === 'fulfilled') queryImgVec = imgVecRes.value;
    if (phashRes.status === 'fulfilled') imagePhash = phashRes.value;
    const tEmbed = Date.now();

    // Parallel multi-channel search
    const [pHashDishId, lexicalHits, textHits, imageHits] = await Promise.all([
      imagePhash
        ? this.retrieval.searchPHash(imagePhash)
        : Promise.resolve(null),
      this.retrieval.searchLexical(terms, primary),
      queryTextVec
        ? this.retrieval.searchDenseText(queryTextVec)
        : Promise.resolve([]),
      queryImgVec
        ? this.retrieval.searchDenseImage(queryImgVec)
        : Promise.resolve([]),
    ]);

    // Reciprocal Rank Fusion -> shortlist 8
    const fused = this.retrieval.fuse(
      lexicalHits,
      textHits,
      imageHits,
      pHashDishId,
      8,
    );
    const tRetrieval = Date.now();

    if (!fused.length) {
      const latency = Date.now() - startTime;
      void this.logScanEvent(scanId, userId, imagePhash, extraction, [], 'NO_MATCH', null, model, latency);
      const reportId = image
        ? await this.autoReport(scanId, userId, image, imagePhash, extraction, [])
        : undefined;
      return reportId ? { ...response, reportId } : response;
    }

    // Fetch shortlist dishes from DB
    const dishIds = fused.map((f) => f.dishId);
    const dishes = await this.prisma.db.dish.findMany({
      where: {
        id: { in: dishIds },
        status: 'PUBLISHED',
        deletedAt: null,
      },
      include: {
        nutrition: true,
        media: {
          where: {
            isPrimary: true,
            moderationStatus: 'APPROVED',
            type: 'IMAGE',
          },
          take: 1,
        },
        dishIngredients: { include: { ingredient: true } },
        categories: { include: { category: true } },
      },
    });

    const dishMap = new Map(dishes.map((d) => [d.id, d]));
    const orderedDishes = fused
      .map((f) => ({ fused: f, dish: dishMap.get(f.dishId) }))
      .filter(
        (
          item,
        ): item is {
          fused: (typeof fused)[0];
          dish: NonNullable<(typeof item)['dish']>;
        } => !!item.dish,
      );

    // Gating check: if top candidate has high consensus, skip closed-set reranking
    const skipRerank =
      !image || this.retrieval.shouldSkipRerank(fused, Boolean(queryImgVec));

    let rerankBestIndex: number | null = null;
    let rerankConfidence = 0;
    let rerankRan = false;

    if (!skipRerank && image && orderedDishes.length) {
      const rerankInput = orderedDishes.map((item, idx) => ({
        index: idx + 1,
        dishId: item.dish.id,
        name: item.dish.name,
        alternateNames: item.dish.alternateNames,
        categoryName: item.dish.categories[0]?.category?.name || null,
        keyIngredients: item.dish.dishIngredients
          .map((i) => i.ingredient?.name || i.parsedName)
          .filter((s): s is string => Boolean(s)),
      }));

      const rerankResult = await this.rerank.rerank(image, rerankInput);
      rerankBestIndex = rerankResult.bestIndex;
      rerankConfidence = rerankResult.confidence;
      rerankRan = rerankResult.ran;
    }
    const tRerank = Date.now();

    // Score and rank candidates
    const scoredCandidates: FoodScanCandidate[] = orderedDishes.map(
      ({ fused: f, dish }, idx) => {
        const dishIndex = idx + 1;
        const ingredient =
          extraction.quality === 'GOOD'
            ? ingredientPrecision(
                extraction.visibleIngredients,
                dish.dishIngredients.map((i) =>
                  [
                    i.ingredient?.name,
                    ...(i.ingredient?.synonyms ?? []),
                    i.parsedName,
                  ].filter((s): s is string => !!s),
                ),
              )
            : null;

        let rerankWeight = 0;
        if (rerankBestIndex === dishIndex) {
          rerankWeight = rerankConfidence;
        } else if (rerankBestIndex !== null) {
          rerankWeight = 0;
        }

        // Composite scoring
        let finalScore = 0;
        if (rerankConfidence > 0) {
          finalScore =
            0.55 * rerankWeight +
            0.30 * f.rrfNorm +
            0.15 * (ingredient ?? 0.5);
        } else {
          finalScore =
            0.75 * f.rrfNorm +
            0.25 * (ingredient ?? 0.5);
        }

        const score = Number(Math.max(0, Math.min(1, finalScore)).toFixed(4));
        const confidenceLabel: 'HIGH' | 'MEDIUM' | 'LOW' =
          score >= 0.75 ? 'HIGH' : score >= 0.50 ? 'MEDIUM' : 'LOW';

        const matchSource: FoodScanCandidate['matchSource'] =
          f.matchSource === 'PHASH'
            ? 'PHASH'
            : rerankBestIndex === dishIndex
              ? 'RERANK'
              : f.matchSource;

        const nutrition = dish.nutrition;
        const mapped = mapNutritionToPlanServing(
          nutrition
            ? { ...nutrition, servingsPerRecipe: nutrition.servings }
            : null,
        );

        const supabaseUrl =
          this.config.get<string>('SUPABASE_URL') ||
          this.config.get<string>('app.supabase.url');

        return {
          dishId: dish.id,
          name: dish.name,
          imageUrl:
            dish.media[0] && supabaseUrl
              ? `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${dish.media[0].bucket}/${dish.media[0].storageKey}`
              : null,
          score,
          matchSource,
          confidenceLabel,
          nutrition: {
            calories: mapped.kcal,
            proteinG: mapped.proteinG,
            carbsG: mapped.carbsG,
            fatG: mapped.fatG,
            servingName: nutrition?.servingName ?? null,
            servingG:
              nutrition?.servingG == null ? null : Number(nutrition.servingG),
            basis: nutrition?.basis ? 'PER_SERVING' : null,
          },
        };
      },
    );

    // Sort by final score descending
    scoredCandidates.sort((a, b) => b.score - a.score);
    let topCandidates = scoredCandidates.slice(0, 5);

    const topFused = topCandidates[0]
      ? fused.find((f) => f.dishId === topCandidates[0].dishId)
      : undefined;
    const evidence: FoodScanEvidence = {
      rerankRan,
      rerankBestIndex,
      topIsPhash: topFused?.matchSource === 'PHASH',
      topLexicalScore: topFused?.lexicalScore ?? 0,
    };
    const status = selectFoodScanStatus(extraction, topCandidates, evidence);
    if (status === 'UNKNOWN_DISH') {
      topCandidates = capUnknownDishCandidates(topCandidates);
    }
    const chosenDishId =
      status === 'MATCHED' ? topCandidates[0]?.dishId : null;

    // Log feedback/search event asynchronously (best-effort)
    const latencyMs = Date.now() - startTime;
    this.logger.log(
      `[FoodScan Pipeline] Total: ${latencyMs}ms (embed: ${tEmbed - startTime}ms, retrieval+fusion: ${tRetrieval - tEmbed}ms, rerank: ${tRerank - tRetrieval}ms, status: ${status}, top: "${topCandidates[0]?.name ?? 'none'}" [${topCandidates[0]?.score ?? 0}])`,
    );

    this.logScanEvent(
      scanId,
      userId,
      imagePhash,
      extraction,
      topCandidates,
      status,
      chosenDishId,
      model,
      latencyMs,
    );

    const reportId =
      (status === 'UNKNOWN_DISH' || status === 'NO_MATCH') && image
        ? await this.autoReport(
            scanId,
            userId,
            image,
            imagePhash,
            extraction,
            topCandidates.map((c) => c.dishId),
          )
        : undefined;

    return {
      scanId,
      status,
      recognizedName: extraction.primaryName,
      confidence: topCandidates[0]?.score ?? 0,
      matchSource: topCandidates[0]?.matchSource ?? 'LEXICAL',
      candidates: topCandidates,
      model,
      ...(reportId ? { reportId } : {}),
    };
  }

  async recordFeedback(
    scanId: string,
    userId: string | undefined,
    dto: { dishId?: string | null; correct: boolean },
  ) {
    const event = await this.prisma.db.foodScanEvent.findUnique({
      where: { id: scanId },
    });

    if (!event || (event.userId && userId && event.userId !== userId)) {
      throw new NotFoundException(`Food scan event ${scanId} not found`);
    }
    if (dto.dishId) {
      const dish = await this.prisma.db.dish.findFirst({
        where: { id: dto.dishId, status: 'PUBLISHED', deletedAt: null },
        select: { id: true },
      });
      if (!dish) throw new BadRequestException('FOOD_SCAN_INVALID_DISH');
    }

    await this.prisma.db.foodScanEvent.update({
      where: { id: scanId },
      data: {
        chosenDishId: dto.dishId ?? null,
        correct: dto.correct,
        confirmedAt: new Date(),
      },
    });

    return { success: true, scanId };
  }

  async getAlternateNameSuggestions(minOccurrences = 3) {
    const rows = await this.prisma.db.$queryRaw<
      {
        recognized_name: string;
        chosen_dish_id: string;
        dish_name: string;
        alternate_names: string[];
        occurrences: number;
      }[]
    >(Prisma.sql`
      SELECT
        fse.extraction->>'primaryName' AS recognized_name,
        fse.chosen_dish_id::text,
        d.name AS dish_name,
        d.alternate_names,
        COUNT(*)::int AS occurrences
      FROM food_scan_events fse
      JOIN dishes d ON d.id = fse.chosen_dish_id
      WHERE fse.chosen_dish_id IS NOT NULL
        AND fse.correct = true
        AND fse.extraction->>'primaryName' IS NOT NULL
        AND fse.extraction->>'primaryName' != d.name
        AND NOT (fse.extraction->>'primaryName' = ANY(d.alternate_names))
      GROUP BY fse.extraction->>'primaryName', fse.chosen_dish_id, d.name, d.alternate_names
      HAVING COUNT(*) >= ${minOccurrences}
      ORDER BY occurrences DESC
    `);

    return rows;
  }

  private async logScanEvent(
    scanId: string,
    userId: string | undefined,
    imagePhash: string | null,
    extraction: FoodScanExtraction,
    candidates: FoodScanCandidate[],
    status: string,
    chosenDishId: string | null,
    model: string,
    latencyMs: number,
  ) {
    try {
      await this.prisma.db.$executeRawUnsafe(
        `INSERT INTO food_scan_events (id, user_id, image_phash, extraction, shortlist, result_status, chosen_dish_id, model, latency_ms, created_at)
         VALUES ($1::uuid, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9, now())`,
        scanId,
        userId ? userId : null,
        imagePhash,
        JSON.stringify(extraction),
        JSON.stringify(
          candidates.map((c) => ({
            dishId: c.dishId,
            name: c.name,
            score: c.score,
          })),
        ),
        status,
        chosenDishId ? chosenDishId : null,
        model,
        latencyMs,
      );
    } catch (e) {
      this.logger.warn(`Could not log food_scan_event: ${e}`);
    }
  }
}
