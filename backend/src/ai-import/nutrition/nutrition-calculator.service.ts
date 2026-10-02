import { Injectable, Logger, Optional } from '@nestjs/common';
import { ExtractedIngredient } from '../ai-import.types';
import { estimateGrams, GramEstimate } from './unit-gram-estimates';
import {
  NutritionNutrients,
  NutritionSourceMatch,
  NutritionSourceRegistry,
} from './nutrition-source-adapter';
import { VIETNAM_FCT_2007_SOURCE } from './vietnam-fct-2007.data';

export type NutritionMethod = 'SOURCE_VERIFIED' | 'INGREDIENT_CALCULATED' | 'AI_ESTIMATED';

export interface NutritionTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sodiumMg: number;
}

export interface NutritionProvenanceReference {
  provider: string;
  title: string;
  url: string;
}

export interface NutritionProvenanceIngredient {
  name: string;
  grams: number | null;
  gramsBasis: GramEstimate['basis'];
  provider: string | null;
  sourceFoodId: string | null;
  sourceFoodName: string | null;
  sourceUrl: string | null;
  matched: boolean;
  matchConfidence: number | null;
}

export interface NutritionProvenance {
  method: NutritionMethod;
  generatedBy: 'CALCULATOR' | 'AI' | 'SOURCE';
  pipelineVersion: string;
  servingBasis: 'PER_SERVING';
  servings: number;
  references: NutritionProvenanceReference[];
  perIngredient: NutritionProvenanceIngredient[];
  uncovered: string[];
  coveragePct: number;
  totalGrams: number;
  calculatedAt: string;
  sourceVerified: boolean;
  notes?: string[];
}

export interface NutritionCalculationResult {
  method: NutritionMethod;
  confidence: number;
  sourceUrl: string | null;
  servingName: string;
  servingG: number;
  perServing: NutritionTotals;
  wholeRecipe: NutritionTotals;
  provenance: NutritionProvenance;
}

export interface NutritionCalculatorInput {
  dishName: string;
  servings: number;
  servingSize?: string | null;
  ingredients: ExtractedIngredient[];
  /** Nutrition từ JSON-LD của nguồn (per serving) nếu có. */
  sourceNutrition?: { url: string; values: Record<string, number | null> } | null;
  /**
   * Fallback AI cho nguyên liệu không khớp DB. Trả per 100g.
   * Fail-soft: nếu lỗi/null thì nguyên liệu được đánh dấu uncovered.
   */
  aiIngredientFallback?: (
    ingredients: Array<{ name: string; grams: number }>,
  ) => Promise<Array<{ name: string; per100g: NutritionNutrients } | null>>;
  /** Fallback toàn món khi coverage thấp. */
  aiDishFallback?: () => Promise<{
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number;
    sodiumMg: number;
    servingName?: string;
    servingG?: number;
    reference?: string | null;
  } | null>;
}

const COVERAGE_THRESHOLD = 70;
const PIPELINE_VERSION = '1.2';
const USDA_REFERENCE: NutritionProvenanceReference = {
  provider: 'USDA_FDC',
  title: 'USDA FoodData Central (U.S. Department of Agriculture)',
  url: 'https://fdc.nal.usda.gov/',
};

/** Những nguyên liệu không đóng góp dinh dưỡng đáng kể và không nên tính vào coverage. */
const NEGLIGIBLE_PATTERNS = /^(nuoc|nuoc loc|nuoc soi|nuoc lanh|da|da vien|nuoc dun soi)$/;

/**
 * Tính dinh dưỡng từ từng nguyên liệu: gram ước lượng x giá trị /100g từ VFCT 2007 -> USDA -> AI.
 * Luôn trả về provenance để admin/kiểm duyệt thấy rõ nguồn và phương pháp.
 */
@Injectable()
export class NutritionCalculatorService {
  private readonly logger = new Logger(NutritionCalculatorService.name);

  constructor(@Optional() private readonly registry?: NutritionSourceRegistry) {}

  async calculate(input: NutritionCalculatorInput): Promise<NutritionCalculationResult> {
    const servings = Math.max(1, Math.round(input.servings || 1));
    const calculatedAt = new Date().toISOString();
    const notes: string[] = [];

    const perIngredient: NutritionProvenanceIngredient[] = [];
    const totals = zeroTotals();
    let coveredGrams = 0;
    let totalGrams = 0;
    const references = new Map<string, NutritionProvenanceReference>();
    const unmatched: Array<{ index: number; name: string; grams: number }> = [];

    for (const ingredient of input.ingredients) {
      const name = ingredient.name?.trim() || ingredient.rawText;
      const estimate = estimateGrams({
        name,
        quantity: ingredient.quantity,
        quantityTo: ingredient.quantityTo,
        unitCode: ingredient.unitCode,
        normalizedWeightGram: ingredient.normalizedWeightGram,
      });
      const entry: NutritionProvenanceIngredient = {
        name,
        grams: estimate.grams,
        gramsBasis: estimate.basis,
        provider: null,
        sourceFoodId: null,
        sourceFoodName: null,
        sourceUrl: null,
        matched: false,
        matchConfidence: null,
      };
      perIngredient.push(entry);

      const negligible = NEGLIGIBLE_PATTERNS.test(normalizeKey(name));
      if (!estimate.grams || estimate.grams <= 0 || negligible) {
        if (negligible) entry.matched = true;
        continue;
      }
      totalGrams += estimate.grams;

      const match = await this.lookup(ingredient.canonicalNameCandidate || name, name);
      if (!match) {
        unmatched.push({ index: perIngredient.length - 1, name, grams: estimate.grams });
        continue;
      }
      this.accumulate(totals, match.nutrients, estimate.grams, match.basisGram);
      coveredGrams += estimate.grams;
      entry.matched = true;
      entry.provider = this.providerOf(match);
      entry.sourceFoodId = match.sourceFoodId;
      entry.sourceFoodName = match.sourceFoodName;
      entry.sourceUrl = match.source.uri;
      entry.matchConfidence = match.confidence;
      this.addReference(references, entry.provider);
    }

    // AI per-ingredient fallback cho phần chưa khớp.
    if (unmatched.length && input.aiIngredientFallback) {
      try {
        const results = await input.aiIngredientFallback(
          unmatched.map((item) => ({ name: item.name, grams: item.grams })),
        );
        unmatched.forEach((item, idx) => {
          const result = results?.[idx];
          if (!result?.per100g) return;
          this.accumulate(totals, result.per100g, item.grams, 100);
          coveredGrams += item.grams;
          const entry = perIngredient[item.index];
          entry.matched = true;
          entry.provider = 'AI_ESTIMATE';
          entry.sourceFoodName = result.name || item.name;
          entry.matchConfidence = 40;
        });
        notes.push(`AI ước lượng ${results?.filter(Boolean).length ?? 0}/${unmatched.length} nguyên liệu không có trong VFCT/USDA.`);
      } catch (error) {
        this.logger.warn(`AI ingredient fallback failed: ${(error as Error).message}`);
      }
    }

    const dbCoveredGrams = perIngredient
      .filter((item) => item.matched && item.provider && item.provider !== 'AI_ESTIMATE')
      .reduce((sum, item) => sum + (item.grams ?? 0), 0);
    const coveragePct = totalGrams > 0 ? Math.round((coveredGrams / totalGrams) * 100) : 0;
    const dbCoveragePct = totalGrams > 0 ? Math.round((dbCoveredGrams / totalGrams) * 100) : 0;
    const uncovered = perIngredient.filter((item) => !item.matched).map((item) => item.name);

    // ── 1) SOURCE_VERIFIED nếu nguồn JSON-LD có nutrition hợp lệ ────────────
    const sourceTotals = input.sourceNutrition ? this.fromSource(input.sourceNutrition.values) : null;
    if (sourceTotals && sourceTotals.calories > 0) {
      references.set('SOURCE', {
        provider: 'RECIPE_SOURCE',
        title: `Nutrition từ trang công thức (${safeHost(input.sourceNutrition!.url)})`,
        url: input.sourceNutrition!.url,
      });
      const servingG = this.servingGrams(input.servingSize, totalGrams, servings);
      return {
        method: 'SOURCE_VERIFIED',
        confidence: Math.max(85, coveragePct),
        sourceUrl: input.sourceNutrition!.url,
        servingName: this.servingName(input.servingSize, servingG),
        servingG,
        perServing: roundTotals(sourceTotals),
        wholeRecipe: roundTotals(scale(sourceTotals, servings)),
        provenance: {
          method: 'SOURCE_VERIFIED',
          generatedBy: 'SOURCE',
          pipelineVersion: PIPELINE_VERSION,
          servingBasis: 'PER_SERVING',
          servings,
          references: [...references.values()],
          perIngredient,
          uncovered,
          coveragePct,
          totalGrams: round(totalGrams),
          calculatedAt,
          sourceVerified: true,
          notes: [...notes, 'Giá trị lấy trực tiếp từ Schema.org Recipe.nutrition của nguồn.'],
        },
      };
    }

    // ── 2) INGREDIENT_CALCULATED khi coverage đủ ────────────────────────────
    if (totalGrams > 0 && coveragePct >= COVERAGE_THRESHOLD) {
      const perServing = scale(totals, 1 / servings);
      const servingG = this.servingGrams(input.servingSize, totalGrams, servings);
      const confidence = Math.round(
        Math.min(95, dbCoveragePct * 0.85 + (coveragePct - dbCoveragePct) * 0.5),
      );
      return {
        method: 'INGREDIENT_CALCULATED',
        confidence: Math.max(50, confidence),
        sourceUrl: references.has('VIETNAM_FCT_2007')
          ? VIETNAM_FCT_2007_SOURCE.url
          : references.has('USDA_FDC')
            ? USDA_REFERENCE.url
            : null,
        servingName: this.servingName(input.servingSize, servingG),
        servingG,
        perServing: roundTotals(perServing),
        wholeRecipe: roundTotals(totals),
        provenance: {
          method: 'INGREDIENT_CALCULATED',
          generatedBy: 'CALCULATOR',
          pipelineVersion: PIPELINE_VERSION,
          servingBasis: 'PER_SERVING',
          servings,
          references: [...references.values()],
          perIngredient,
          uncovered,
          coveragePct,
          totalGrams: round(totalGrams),
          calculatedAt,
          sourceVerified: false,
          notes: [
            ...notes,
            `Tổng ${round(totalGrams)}g nguyên liệu; ${coveragePct}% khối lượng có dữ liệu (VFCT/USDA: ${dbCoveragePct}%). Chia ${servings} phần.`,
          ],
        },
      };
    }

    // ── 3) AI_ESTIMATED fallback ────────────────────────────────────────────
    let aiTotals: NutritionTotals | null = null;
    let aiServingName: string | undefined;
    let aiServingG: number | undefined;
    let aiReference: string | null = null;
    if (input.aiDishFallback) {
      try {
        const ai = await input.aiDishFallback();
        if (ai) {
          aiTotals = {
            calories: ai.calories,
            proteinG: ai.proteinG,
            carbsG: ai.carbsG,
            fatG: ai.fatG,
            fiberG: ai.fiberG,
            sodiumMg: ai.sodiumMg,
          };
          aiServingName = ai.servingName;
          aiServingG = ai.servingG;
          aiReference = ai.reference ?? null;
        }
      } catch (error) {
        this.logger.warn(`AI dish nutrition fallback failed: ${(error as Error).message}`);
      }
    }
    // Nếu không có AI nhưng có một phần dữ liệu tính được, dùng phần đó (đã hạ confidence).
    const partial = totalGrams > 0 && coveragePct > 0 ? scale(totals, 1 / servings) : null;
    const perServing = aiTotals ?? partial ?? zeroTotals();
    const servingG = aiServingG && aiServingG > 0
      ? aiServingG
      : this.servingGrams(input.servingSize, totalGrams, servings);
    notes.push(
      coveragePct < COVERAGE_THRESHOLD
        ? `Chỉ ${coveragePct}% khối lượng có dữ liệu (< ${COVERAGE_THRESHOLD}%) nên dùng ước lượng AI.`
        : 'Không ước lượng được khối lượng nguyên liệu nên dùng ước lượng AI.',
    );
    if (aiReference) notes.push(`AI tham chiếu: ${aiReference}`);
    return {
      method: 'AI_ESTIMATED',
      confidence: aiTotals ? Math.min(60, 40 + Math.round(coveragePct / 5)) : Math.max(20, Math.round(coveragePct / 2)),
      sourceUrl: null,
      servingName: aiServingName?.trim() || this.servingName(input.servingSize, servingG),
      servingG,
      perServing: roundTotals(perServing),
      wholeRecipe: roundTotals(scale(perServing, servings)),
      provenance: {
        method: 'AI_ESTIMATED',
        generatedBy: 'AI',
        pipelineVersion: PIPELINE_VERSION,
        servingBasis: 'PER_SERVING',
        servings,
        references: [...references.values()],
        perIngredient,
        uncovered,
        coveragePct,
        totalGrams: round(totalGrams),
        calculatedAt,
        sourceVerified: false,
        notes,
      },
    };
  }

  private async lookup(canonical: string, fallbackName: string): Promise<NutritionSourceMatch | null> {
    if (!this.registry) return null;
    const names = [...new Set([canonical, fallbackName].filter(Boolean))];
    for (const name of names) {
      try {
        const matches = await this.registry.lookup({ canonicalName: name, locale: 'vi' });
        // Ưu tiên VFCT cho nguyên liệu Việt; registry đã sort theo confidence.
        const preferred =
          matches.find((m) => this.providerOf(m) === 'VIETNAM_FCT_2007' && m.confidence >= 60)
          ?? matches[0];
        if (preferred && preferred.confidence >= 50) return preferred;
      } catch (error) {
        this.logger.warn(`Nutrition lookup failed for "${name}": ${(error as Error).message}`);
      }
    }
    return null;
  }

  private providerOf(match: NutritionSourceMatch): string {
    if (match.source.uri.includes('fdc.nal.usda.gov')) return 'USDA_FDC';
    if (match.source.uri.includes('viendinhduong')) return 'VIETNAM_FCT_2007';
    return match.source.publisher ?? 'NUTRITION_DATABASE';
  }

  private addReference(map: Map<string, NutritionProvenanceReference>, provider: string | null) {
    if (!provider || map.has(provider)) return;
    if (provider === 'VIETNAM_FCT_2007') {
      map.set(provider, {
        provider,
        title: VIETNAM_FCT_2007_SOURCE.title,
        url: VIETNAM_FCT_2007_SOURCE.url,
      });
    } else if (provider === 'USDA_FDC') {
      map.set(provider, USDA_REFERENCE);
    }
  }

  private accumulate(
    totals: NutritionTotals,
    nutrients: NutritionNutrients,
    grams: number,
    basisGram: number,
  ) {
    const factor = grams / (basisGram || 100);
    totals.calories += (nutrients.caloriesKcal ?? 0) * factor;
    totals.proteinG += (nutrients.proteinG ?? 0) * factor;
    totals.carbsG += (nutrients.carbsG ?? 0) * factor;
    totals.fatG += (nutrients.fatG ?? 0) * factor;
    totals.fiberG += (nutrients.fiberG ?? 0) * factor;
    totals.sodiumMg += (nutrients.sodiumMg ?? 0) * factor;
  }

  private fromSource(values: Record<string, number | null>): NutritionTotals | null {
    const pick = (...keys: string[]) => {
      for (const key of keys) {
        const value = values[key];
        if (typeof value === 'number' && Number.isFinite(value)) return value;
      }
      return 0;
    };
    const calories = pick('calories', 'caloriesKcal', 'kcal');
    if (!calories) return null;
    return {
      calories,
      proteinG: pick('proteinG', 'proteinContent', 'protein'),
      carbsG: pick('carbsG', 'carbohydrateContent', 'carbs'),
      fatG: pick('fatG', 'fatContent', 'fat'),
      fiberG: pick('fiberG', 'fiberContent', 'fiber'),
      sodiumMg: pick('sodiumMg', 'sodiumContent', 'sodium'),
    };
  }

  private servingGrams(servingSize: string | null | undefined, totalGrams: number, servings: number): number {
    const fromText = servingSize?.match(/(\d{2,4})\s*g/i);
    if (fromText) return Number(fromText[1]);
    if (totalGrams > 0) {
      // Trừ ~15% hao hụt khi nấu (nước bay hơi, bỏ xương/vỏ).
      return Math.round((totalGrams * 0.85) / servings);
    }
    return 300;
  }

  private servingName(servingSize: string | null | undefined, servingG: number): string {
    const text = servingSize?.trim();
    if (text) return text.substring(0, 98);
    return `1 phần (${servingG}g)`;
  }
}

function zeroTotals(): NutritionTotals {
  return { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sodiumMg: 0 };
}

function scale(totals: NutritionTotals, factor: number): NutritionTotals {
  return {
    calories: totals.calories * factor,
    proteinG: totals.proteinG * factor,
    carbsG: totals.carbsG * factor,
    fatG: totals.fatG * factor,
    fiberG: totals.fiberG * factor,
    sodiumMg: totals.sodiumMg * factor,
  };
}

function roundTotals(totals: NutritionTotals): NutritionTotals {
  return {
    calories: Math.round(totals.calories),
    proteinG: round(totals.proteinG, 1),
    carbsG: round(totals.carbsG, 1),
    fatG: round(totals.fatG, 1),
    fiberG: round(totals.fiberG, 1),
    sodiumMg: Math.round(totals.sodiumMg),
  };
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
