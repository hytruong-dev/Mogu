import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { normalizeVietnamese } from '../ingredient.service';
import {
  NutritionIngredientQuery,
  NutritionNutrients,
  NutritionSourceAdapter,
  NutritionSourceMatch,
} from './nutrition-source-adapter';
import { toEnglishIngredientQuery } from './ingredient-english-aliases';

interface FdcFoodNutrient {
  nutrientId?: number;
  nutrientNumber?: string;
  nutrientName?: string;
  unitName?: string;
  value?: number;
}

interface FdcFood {
  fdcId: number;
  description: string;
  dataType?: string;
  foodNutrients?: FdcFoodNutrient[];
}

/** Nutrient IDs theo USDA FDC (https://fdc.nal.usda.gov/). */
const NUTRIENT_IDS = {
  energyKcal: [1008, 2047, 2048],
  protein: [1003],
  fat: [1004],
  carbs: [1005, 1050],
  fiber: [1079],
  sodium: [1093],
};

/**
 * USDA FoodData Central — dùng cho nguyên liệu không có trong VFCT.
 * Dịch tên VI -> EN bằng bảng alias, cache in-memory, fail-soft khi lỗi mạng.
 */
@Injectable()
export class UsdaFdcAdapter implements NutritionSourceAdapter {
  readonly providerCode = 'USDA_FDC';
  private readonly logger = new Logger(UsdaFdcAdapter.name);
  private readonly cache = new Map<string, NutritionSourceMatch[]>();
  // Không đưa vào constructor: Nest DI sẽ coi tham số optional là dependency không có token.
  private fetchImpl: typeof fetch = (input, init) => globalThis.fetch(input, init);

  constructor(private readonly config: ConfigService) {}

  /** Chỉ dùng trong test để mock HTTP. */
  setFetch(fetchImpl: typeof fetch): this {
    this.fetchImpl = fetchImpl;
    return this;
  }

  isEnabled(): boolean {
    if (!this.apiKey()) return false;
    const raw = this.config.get<string | boolean>('AI_IMPORT_ENABLE_NUTRITION_DATABASES');
    if (raw === undefined || raw === null || raw === '') return true;
    if (typeof raw === 'boolean') return raw;
    return ['1', 'true', 'yes', 'on'].includes(String(raw).trim().toLowerCase());
  }

  async lookup(query: NutritionIngredientQuery): Promise<NutritionSourceMatch[]> {
    const apiKey = this.apiKey();
    if (!apiKey) return [];
    const english = toEnglishIngredientQuery(query.canonicalName);
    if (!english) return [];
    const cacheKey = english.toLowerCase();
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams({
      query: english,
      dataType: 'Foundation,SR Legacy',
      pageSize: '5',
      api_key: apiKey,
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await this.fetchImpl(
        `https://api.nal.usda.gov/fdc/v1/foods/search?${params.toString()}`,
        { signal: controller.signal, headers: { accept: 'application/json' } },
      );
      if (!res.ok) {
        this.logger.warn(`USDA FDC HTTP ${res.status} for "${english}"`);
        return [];
      }
      const data = (await res.json()) as { foods?: FdcFood[] };
      const foods = (data.foods ?? []).filter((food) => food.foodNutrients?.length);
      if (!foods.length) {
        this.cache.set(cacheKey, []);
        return [];
      }
      const best = this.pickBest(foods, english);
      const nutrients = this.toNutrients(best.foodNutrients ?? []);
      const matches: NutritionSourceMatch[] = [
        {
          sourceFoodId: String(best.fdcId),
          sourceFoodName: best.description,
          basisGram: 100,
          nutrients,
          confidence: this.scoreConfidence(best, english),
          source: {
            kind: 'NUTRITION_DATABASE',
            uri: `https://fdc.nal.usda.gov/food-details/${best.fdcId}/nutrients`,
            title: `USDA FoodData Central — ${best.description} (FDC ID ${best.fdcId})`,
            publisher: 'U.S. Department of Agriculture',
            retrievedAt: new Date().toISOString(),
          },
        },
      ];
      this.cache.set(cacheKey, matches);
      return matches;
    } catch (error) {
      this.logger.warn(`USDA FDC lookup failed for "${english}": ${(error as Error).message}`);
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  private pickBest(foods: FdcFood[], english: string): FdcFood {
    const keywords = normalizeVietnamese(english).split(' ').filter((k) => k.length > 2);
    const scored = foods.map((food) => {
      const desc = normalizeVietnamese(food.description);
      const hits = keywords.filter((k) => desc.includes(k)).length;
      // Ưu tiên dạng raw / fresh, tránh "cooked", "fried", "canned".
      const penalty = /\b(cooked|fried|canned|roasted|baked|braised|dried)\b/.test(desc) &&
        !/\b(cooked|fried|canned|roasted|baked|braised|dried)\b/.test(normalizeVietnamese(english))
        ? 0.5
        : 0;
      const bonus = food.dataType === 'Foundation' ? 0.25 : 0;
      return { food, score: hits + bonus - penalty };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0].food;
  }

  private scoreConfidence(food: FdcFood, english: string): number {
    const keywords = normalizeVietnamese(english).split(' ').filter((k) => k.length > 2);
    if (!keywords.length) return 60;
    const desc = normalizeVietnamese(food.description);
    const hits = keywords.filter((k) => desc.includes(k)).length;
    return Math.round(55 + 35 * (hits / keywords.length));
  }

  private toNutrients(list: FdcFoodNutrient[]): NutritionNutrients {
    const pick = (ids: number[]): number | null => {
      for (const id of ids) {
        const found = list.find((n) => n.nutrientId === id);
        if (found && typeof found.value === 'number') {
          // Energy có thể trả kJ ở id 1062; chúng ta chỉ dùng id kcal.
          return Math.round(found.value * 100) / 100;
        }
      }
      return null;
    };
    return {
      caloriesKcal: pick(NUTRIENT_IDS.energyKcal),
      proteinG: pick(NUTRIENT_IDS.protein),
      fatG: pick(NUTRIENT_IDS.fat),
      carbsG: pick(NUTRIENT_IDS.carbs),
      fiberG: pick(NUTRIENT_IDS.fiber),
      sodiumMg: pick(NUTRIENT_IDS.sodium),
    };
  }

  private apiKey(): string | undefined {
    const key = this.config.get<string>('USDA_API_KEY');
    return key?.trim() || undefined;
  }
}
