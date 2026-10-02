import { Injectable } from '@nestjs/common';
import {
  DishClassificationCandidate,
  FieldWarning,
  IngredientCandidate,
  IngredientResolution,
} from './ai-import.types';
import {
  CategoryRuleMatch,
  DishTypeCode,
  inferDishType,
  isCategoryOf,
  matchDishCategory,
  resolveCategoryCode,
} from './classification/dish-category-rules';

export interface ClassificationRuleInput {
  candidate: DishClassificationCandidate;
  ingredients: IngredientResolution[];
  dictionary: IngredientCandidate[];
  /** Tên món để áp rule category/dishType theo từ khóa. */
  dishName?: string;
  /** Mã category hợp lệ trong taxonomy (để không gán mã không tồn tại). */
  allowedCategoryCodes?: string[];
  allowedMealTypeCodes?: string[];
  nutrition?: {
    caloriesKcal?: number | null;
    proteinG?: number | null;
    fiberG?: number | null;
    sodiumMg?: number | null;
  };
  priceEvidenceReliable?: boolean;
  isRegionalSpecialty?: boolean;
}

export interface ClassificationRuleResult {
  categoryCodes: string[];
  mealTypeCodes: string[];
  goalCodes: string[];
  dietTypeCodes: string[];
  flavorCodes: string[];
  dishType: DishTypeCode | null;
  categoryRule: CategoryRuleMatch | null;
  warnings: FieldWarning[];
}

@Injectable()
export class ClassificationRulesService {
  evaluate(input: ClassificationRuleInput): ClassificationRuleResult {
    const warnings: FieldWarning[] = [];
    const resolved = input.ingredients
      .filter((item) => item.matchedIngredientId)
      .map((item) => input.dictionary.find(
        (candidate) => candidate.id === item.matchedIngredientId,
      ))
      .filter((item): item is IngredientCandidate => Boolean(item));
    const hasUnresolved = input.ingredients.some(
      (item) => !item.matchedIngredientId || item.confidence < 90,
    );

    const dietTypeCodes = new Set(input.candidate.dietTypeCodes);
    if (!hasUnresolved && resolved.length) {
      if (resolved.every((item) => item.attributes?.vegan === true)) {
        dietTypeCodes.add('VEGAN');
        dietTypeCodes.add('VEGETARIAN');
      } else if (resolved.every((item) => item.attributes?.vegetarian === true)) {
        dietTypeCodes.add('VEGETARIAN');
        dietTypeCodes.delete('VEGAN');
      } else {
        dietTypeCodes.delete('VEGAN');
        dietTypeCodes.delete('VEGETARIAN');
      }
      if (resolved.every((item) => item.attributes?.glutenFree === true)) {
        dietTypeCodes.add('GLUTEN_FREE');
      } else {
        dietTypeCodes.delete('GLUTEN_FREE');
      }
    } else {
      for (const sensitive of ['VEGAN', 'VEGETARIAN', 'GLUTEN_FREE']) {
        if (dietTypeCodes.delete(sensitive)) {
          warnings.push({
            code: 'AI_IMPORT_DIET_UNVERIFIED',
            fieldPath: 'classification.dietTypeCodes',
            message: `Không thể xác minh ${sensitive} khi còn nguyên liệu chưa resolve.`,
            severity: 'WARNING',
          });
        }
      }
    }

    const flavorCodes = new Set(input.candidate.flavorCodes);
    for (const ingredient of resolved) {
      ingredient.attributes?.flavors?.forEach((flavor) => flavorCodes.add(flavor));
    }

    const goalCodes = new Set(input.candidate.goalCodes);
    const nutrition = input.nutrition;
    if (nutrition) {
      if (
        nutrition.caloriesKcal != null &&
        nutrition.caloriesKcal <= 500 &&
        (nutrition.fiberG ?? 0) >= 5
      ) goalCodes.add('LOSE_WEIGHT');
      else goalCodes.delete('LOSE_WEIGHT');
      if ((nutrition.proteinG ?? 0) >= 25) goalCodes.add('BUILD_MUSCLE');
      else goalCodes.delete('BUILD_MUSCLE');
      if ((nutrition.sodiumMg ?? 0) > 800) goalCodes.delete('HEALTHY');
    }
    if (!input.priceEvidenceReliable) goalCodes.delete('BUDGET');
    if (input.isRegionalSpecialty) goalCodes.add('EXPLORE');

    // ── Category + dishType theo rule tên món ───────────────────────────────
    const { categoryCodes, categoryRule } = this.applyCategoryRules(input, warnings);
    const dishType = this.resolveDishType(input, categoryCodes, categoryRule);

    // ── Meal type mặc định ──────────────────────────────────────────────────
    const mealTypeCodes = this.applyMealTypeDefaults(input, categoryCodes, categoryRule);

    return {
      categoryCodes,
      mealTypeCodes,
      goalCodes: [...goalCodes],
      dietTypeCodes: [...dietTypeCodes],
      flavorCodes: [...flavorCodes],
      dishType,
      categoryRule,
      warnings,
    };
  }

  private applyCategoryRules(
    input: ClassificationRuleInput,
    warnings: FieldWarning[],
  ): { categoryCodes: string[]; categoryRule: CategoryRuleMatch | null } {
    const allowedList = input.allowedCategoryCodes ?? null;
    // Map mã AI về mã thật trong taxonomy (AI có thể trả "NOODLE" trong khi DB dùng "PHO").
    const aiCodes = [...new Set(
      input.candidate.categoryCodes
        .map((code) => (allowedList ? resolveCategoryCode(code.toUpperCase(), allowedList) : code.toUpperCase()))
        .filter((code): code is string => Boolean(code)),
    )];
    const rule = input.dishName ? matchDishCategory(input.dishName) : null;
    // Mã thật trong taxonomy tương ứng với mã chuẩn của rule (NOODLE -> PHO, HOT_POT -> LẨU...).
    const ruleCode = rule ? resolveCategoryCode(rule.categoryCode, allowedList) : null;

    if (!rule || !ruleCode) {
      return { categoryCodes: aiCodes, categoryRule: rule ?? null };
    }

    const meaningfulAi = aiCodes.filter((code) => !isCategoryOf(code, 'OTHER'));
    // Rule "OTHER" chỉ là fallback — không ghi đè AI nếu AI có mã cụ thể.
    if (rule.categoryCode === 'OTHER') {
      return {
        categoryCodes: meaningfulAi.length ? meaningfulAi : [ruleCode],
        categoryRule: rule,
      };
    }

    if (!meaningfulAi.length) {
      if (aiCodes.length) {
        warnings.push({
          code: 'AI_IMPORT_CATEGORY_RULE_OVERRIDE',
          fieldPath: 'classification.categoryCodes',
          message: `AI trả "${aiCodes.join(',')}" — rule tên món gán "${ruleCode}" (khớp "${rule.matchedPattern}").`,
          severity: 'WARNING',
        });
      }
      return { categoryCodes: [ruleCode], categoryRule: rule };
    }

    if (!meaningfulAi.includes(ruleCode)) {
      warnings.push({
        code: 'AI_IMPORT_CATEGORY_RULE_OVERRIDE',
        fieldPath: 'classification.categoryCodes',
        message: `AI trả "${meaningfulAi.join(',')}" mâu thuẫn với rule tên món "${ruleCode}" (khớp "${rule.matchedPattern}"). Rule được ưu tiên.`,
        severity: 'WARNING',
      });
      // Rule đứng đầu; giữ tối đa 1 mã AI phụ để không mất thông tin.
      return {
        categoryCodes: [ruleCode, ...meaningfulAi.slice(0, 1)],
        categoryRule: rule,
      };
    }

    // Rule khớp AI: đưa rule lên đầu.
    return {
      categoryCodes: [ruleCode, ...meaningfulAi.filter((code) => code !== ruleCode)],
      categoryRule: rule,
    };
  }

  private resolveDishType(
    input: ClassificationRuleInput,
    categoryCodes: string[],
    rule: CategoryRuleMatch | null,
  ): DishTypeCode | null {
    const name = input.dishName ?? '';
    if (name.trim()) return inferDishType(name, categoryCodes, rule);
    const ai = input.candidate.dishTypeCode?.toUpperCase();
    if (ai === 'WET' || ai === 'DRY') return ai;
    return null;
  }

  private applyMealTypeDefaults(
    input: ClassificationRuleInput,
    categoryCodes: string[],
    rule: CategoryRuleMatch | null,
  ): string[] {
    const allowed = input.allowedMealTypeCodes
      ? new Set(input.allowedMealTypeCodes.map((code) => code.toUpperCase()))
      : null;
    const aiCodes = [...new Set(input.candidate.mealTypeCodes.map((code) => code.toUpperCase()))]
      .filter((code) => !allowed || allowed.has(code));
    const meaningful = aiCodes.filter((code) => code !== 'ANY');
    if (meaningful.length) return meaningful;

    const isAny = (...canonicals: string[]) =>
      categoryCodes.some((code) => canonicals.some((canonical) => isCategoryOf(code, canonical)));
    const defaults = rule?.defaultMealTypes
      ?? (isAny('DESSERT', 'SNACK', 'DRINK')
        ? ['SNACK']
        : isAny('NOODLE', 'SOUP')
          ? ['BREAKFAST', 'LUNCH', 'DINNER']
          : ['LUNCH', 'DINNER']);
    const filtered = defaults.filter((code) => !allowed || allowed.has(code));
    return filtered.length ? filtered : aiCodes;
  }
}
