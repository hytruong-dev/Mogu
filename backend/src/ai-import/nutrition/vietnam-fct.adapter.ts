import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { normalizeVietnamese } from '../ingredient.service';
import {
  NutritionIngredientQuery,
  NutritionSourceAdapter,
  NutritionSourceMatch,
} from './nutrition-source-adapter';
import {
  VIETNAM_FCT_2007,
  VIETNAM_FCT_2007_SOURCE,
  VietnamFctFood,
} from './vietnam-fct-2007.data';

/** Từ mô tả thường gặp trong tên nguyên liệu nhưng không ảnh hưởng tra cứu. */
const NOISE_WORDS = new Set([
  'tuoi', 'song', 'ngon', 'loai', 'to', 'nho', 'vua', 'lon', 'be', 'sach', 'khong', 'co',
  'da', 'duoc', 'thai', 'cat', 'bam', 'xay', 'lat', 'mong', 'nhuyen', 'bo', 'rua', 'cho', 'dung',
  'de', 'an', 'kem', 'phan', 'nguyen', 'con', 'cai', 'qua', 'cu', 'cay', 'nhanh', 'tep', 'la', 'mieng',
]);

@Injectable()
export class VietnamFctAdapter implements NutritionSourceAdapter {
  readonly providerCode = 'VIETNAM_FCT_2007';
  private readonly index: Array<{ alias: string; tokens: string[]; food: VietnamFctFood }>;

  constructor(private readonly config?: ConfigService) {
    this.index = VIETNAM_FCT_2007.flatMap((food) =>
      [...new Set([normalizeVietnamese(food.nameVi), ...food.aliases])]
        .filter(Boolean)
        .map((alias) => ({ alias, tokens: alias.split(' '), food })),
    ).sort((a, b) => b.alias.length - a.alias.length);
  }

  isEnabled(): boolean {
    const raw = this.config?.get<string | boolean>('AI_IMPORT_ENABLE_NUTRITION_DATABASES');
    if (raw === undefined || raw === null || raw === '') return true;
    if (typeof raw === 'boolean') return raw;
    return ['1', 'true', 'yes', 'on'].includes(String(raw).trim().toLowerCase());
  }

  async lookup(query: NutritionIngredientQuery): Promise<NutritionSourceMatch[]> {
    const match = this.findFood(query.canonicalName);
    if (!match) return [];
    const { food, confidence } = match;
    return [
      {
        sourceFoodId: food.fctCode,
        sourceFoodName: food.nameVi,
        basisGram: 100,
        nutrients: {
          caloriesKcal: food.kcal,
          proteinG: food.protein,
          carbsG: food.carbs,
          fatG: food.fat,
          fiberG: food.fiber,
          sodiumMg: food.sodiumMg,
        },
        confidence,
        source: {
          kind: 'NUTRITION_DATABASE',
          uri: VIETNAM_FCT_2007_SOURCE.url,
          title: `${VIETNAM_FCT_2007_SOURCE.title} — mã ${food.fctCode} ${food.nameVi}`,
          publisher: 'Viện Dinh dưỡng Quốc gia',
          retrievedAt: new Date().toISOString(),
        },
      },
    ];
  }

  /** Tìm thực phẩm khớp tên: exact alias -> alias là cụm con dài nhất -> token overlap. */
  findFood(name: string): { food: VietnamFctFood; confidence: number } | null {
    const normalized = normalizeVietnamese(name);
    if (!normalized) return null;
    const padded = ` ${normalized} `;

    const exact = this.index.find((entry) => entry.alias === normalized);
    if (exact) return { food: exact.food, confidence: 98 };

    // Alias xuất hiện như cụm từ trong tên (ưu tiên alias dài nhất: "thit heo ba chi" trước "thit heo").
    const phrase = this.index.find((entry) => padded.includes(` ${entry.alias} `));
    if (phrase) {
      const coverage = phrase.alias.length / normalized.length;
      return { food: phrase.food, confidence: Math.round(70 + 25 * Math.min(1, coverage)) };
    }

    // Token overlap sau khi bỏ từ nhiễu.
    const tokens = normalized.split(' ').filter((t) => t && !NOISE_WORDS.has(t));
    if (!tokens.length) return null;
    let best: { food: VietnamFctFood; score: number } | null = null;
    for (const entry of this.index) {
      const hits = entry.tokens.filter((t) => tokens.includes(t)).length;
      if (!hits) continue;
      const score = hits / Math.max(entry.tokens.length, tokens.length);
      if (score >= 0.5 && (!best || score > best.score)) best = { food: entry.food, score };
    }
    return best ? { food: best.food, confidence: Math.round(50 + 30 * best.score) } : null;
  }
}
