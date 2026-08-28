import { Injectable } from '@nestjs/common';
import {
  DishClassificationCandidate,
  FieldWarning,
  IngredientCandidate,
  IngredientResolution,
} from './ai-import.types';

export interface ClassificationRuleInput {
  candidate: DishClassificationCandidate;
  ingredients: IngredientResolution[];
  dictionary: IngredientCandidate[];
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

    return {
      categoryCodes: [...new Set(input.candidate.categoryCodes)],
      mealTypeCodes: [...new Set(input.candidate.mealTypeCodes)],
      goalCodes: [...goalCodes],
      dietTypeCodes: [...dietTypeCodes],
      flavorCodes: [...flavorCodes],
      warnings,
    };
  }
}
