import type {
  AllergenAssessment,
  DishAllergen,
  DishIngredient,
  DishRecipeStep,
} from './types';
import { DIFF_LABEL } from './tokens';

export { DIFF_LABEL };

export function formatPriceLabel(
  priceMin?: number | null,
  priceMax?: number | null,
): string | null {
  if (priceMin != null && priceMax != null) {
    return `${Math.round(priceMin / 1000)}K–${Math.round(priceMax / 1000)}K`;
  }
  if (priceMax != null) return `~${Math.round(priceMax / 1000)}K`;
  if (priceMin != null) return `~${Math.round(priceMin / 1000)}K`;
  return null;
}

export function formatTimeLabel(
  prepMinutes?: number | null,
  cookMinutes?: number | null,
): string | null {
  const total = (prepMinutes ?? 0) + (cookMinutes ?? 0);
  return total > 0 ? `${total} phút` : null;
}

export function formatKcalLabel(calories?: number | null): string | null {
  if (calories == null || Number.isNaN(Number(calories))) return null;
  return `${Math.round(Number(calories))} kcal`;
}

export function difficultyLabel(difficulty?: string | null): string | null {
  if (!difficulty) return null;
  return DIFF_LABEL[difficulty] ?? difficulty;
}

export function assessAllergens(allergens: DishAllergen[] = []): AllergenAssessment {
  if (allergens.length > 0) {
    const names = allergens.map((a) => a.name).filter(Boolean);
    return {
      status: 'CONTAINS',
      allergens,
      label: 'Có chứa',
      detail: names.length ? names.join(', ') : undefined,
    };
  }
  // Empty array ≠ safe — docs: UNKNOWN
  return {
    status: 'UNKNOWN',
    allergens: [],
    label: 'Lưu ý dị ứng',
    detail: 'Chưa đủ dữ liệu để xác nhận',
  };
}

export function scaleQuantity(
  quantity: number | null,
  baseServings: number,
  servings: number,
): number | null {
  if (quantity == null || !Number.isFinite(quantity)) return null;
  const base = baseServings > 0 ? baseServings : 1;
  const factor = servings / base;
  const scaled = quantity * factor;
  if (Number.isInteger(scaled)) return scaled;
  return Math.round(scaled * 10) / 10;
}

export function formatQuantityUnit(
  quantity: number | null,
  unit: string | null,
  baseServings: number,
  servings: number,
): string | null {
  const q = scaleQuantity(quantity, baseServings, servings);
  if (q == null) {
    if (unit && !quantity) return unit;
    return null;
  }
  const u = (unit?.trim() ?? '').toLowerCase();
  if (!u) return String(q);
  // Metric abbreviations stay compact: 500g, 200ml
  if (/^(g|kg|mg|ml|l|cl)$/i.test(u)) return `${q}${u}`;
  return `${q} ${u}`;
}

export function ingredientDisplayName(ing: DishIngredient): string {
  const raw = (ing.ingredientName || ing.rawText || 'Nguyên liệu').trim();
  // Prefer clean name without leading quantity when quantity is shown separately
  if (ing.quantity != null && ing.ingredientName) {
    return ing.ingredientName.trim();
  }
  // Strip leading "200g " / "1 cái " from rawText when we also render qty
  if (ing.quantity != null) {
    return raw
      .replace(/^\d+([.,]\d+)?\s*(g|kg|mg|ml|l|cl|cái|muỗng|tsp|tbsp)?\s+/i, '')
      .trim() || raw;
  }
  return raw;
}

export function parseStepTitle(instruction: string, order: number): string {
  const first = instruction.split(/\n|\\n/)[0]?.trim() ?? '';
  if (!first) return `Bước ${order}`;
  const cleaned = first
    .replace(/^\d+[\.\)]\s*/, '')
    .replace(/^\*{1,2}|\*{1,2}$/g, '')
    .replace(/\*\*/g, '')
    .trim();
  if (cleaned.length <= 60) return cleaned;
  return `Bước ${order}`;
}

export function parseStepBody(instruction: string): string {
  const lines = instruction.split(/\n|\\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) {
    return instruction.replace(/\*\*/g, '').trim();
  }
  const first = lines[0].replace(/\*\*/g, '');
  if (first.length <= 60) {
    return lines.slice(1).join('\n').replace(/\*\*/g, '').trim();
  }
  return instruction.replace(/\*\*/g, '').trim();
}

export function normalizeSteps(steps: DishRecipeStep[]) {
  return [...steps]
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .map((rs, i) => {
      const order = rs.stepOrder || i + 1;
      const title = rs.title?.trim() || parseStepTitle(rs.instruction, order);
      const body = rs.title?.trim() ? rs.instruction.trim() : parseStepBody(rs.instruction);
      return { ...rs, stepOrder: order, title, body };
    });
}

export function totalStepsDurationMin(steps: DishRecipeStep[]): number | null {
  const mins = steps.map((s) => s.durationMin).filter((d): d is number => d != null && d > 0);
  if (!mins.length) return null;
  return mins.reduce((a, b) => a + b, 0);
}

export function formatDistance(meters?: number | null): string | null {
  if (meters == null) return null;
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

export function formatMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export function groupIngredients(ingredients: DishIngredient[]) {
  const groups: Array<{ label: string | null; items: Array<{ ing: DishIngredient; index: number }> }> = [];
  ingredients.forEach((ing, index) => {
    const label = ing.groupLabel?.trim() || null;
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push({ ing, index });
    } else {
      groups.push({ label, items: [{ ing, index }] });
    }
  });
  return groups;
}
