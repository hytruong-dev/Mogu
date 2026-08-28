import { DishExtractionV11, Difficulty } from './ai-import.types';

export class DishExtractionValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`DishExtractionV11 không hợp lệ: ${issues.join('; ')}`);
  }
}

const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export function validateDishExtractionV11(value: unknown): string[] {
  const issues: string[] = [];
  const root = object(value);
  const basic = object(root.basic);
  const classification = object(root.classification);
  const recipe = object(root.recipe);
  const origin = object(basic.origin);
  const difficulties: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];

  const requiredString = (path: string, input: unknown) => {
    if (typeof input !== 'string' || !input.trim()) issues.push(`${path}: REQUIRED_STRING`);
  };
  const nonNegativeNumber = (path: string, input: unknown, positive = false) => {
    if (
      typeof input !== 'number' ||
      !Number.isFinite(input) ||
      input < (positive ? 1 : 0)
    ) issues.push(`${path}: INVALID_NUMBER`);
  };
  const stringArray = (path: string, input: unknown) => {
    if (!Array.isArray(input) || input.some((item) => typeof item !== 'string')) {
      issues.push(`${path}: INVALID_STRING_ARRAY`);
    }
  };

  if (root.schemaVersion !== '1.1') issues.push('schemaVersion: MUST_EQUAL_1.1');
  requiredString('basic.name', basic.name);
  requiredString('basic.shortDescription', basic.shortDescription);
  stringArray('basic.alternateNames', basic.alternateNames);
  if (!difficulties.includes(basic.difficulty as Difficulty)) {
    issues.push('basic.difficulty: INVALID_ENUM');
  }
  nonNegativeNumber('basic.prepMinutes', basic.prepMinutes);
  nonNegativeNumber('basic.cookMinutes', basic.cookMinutes);
  nonNegativeNumber('basic.servings', basic.servings, true);
  if (typeof origin.isRegionalSpecialty !== 'boolean') {
    issues.push('basic.origin.isRegionalSpecialty: REQUIRED_BOOLEAN');
  }
  nonNegativeNumber('basic.origin.confidence', origin.confidence);
  if (typeof origin.confidence === 'number' && origin.confidence > 100) {
    issues.push('basic.origin.confidence: OUT_OF_RANGE');
  }

  for (const key of [
    'categoryCodes',
    'mealTypeCodes',
    'goalCodes',
    'dietTypeCodes',
    'flavorCodes',
  ]) stringArray(`classification.${key}`, classification[key]);
  if (typeof classification.confidenceByField !== 'object') {
    issues.push('classification.confidenceByField: REQUIRED_OBJECT');
  }

  if (!Array.isArray(root.ingredients)) {
    issues.push('ingredients: REQUIRED_ARRAY');
  } else {
    root.ingredients.forEach((raw, index) => {
      const ingredient = object(raw);
      requiredString(`ingredients.${index}.rawText`, ingredient.rawText);
      requiredString(`ingredients.${index}.name`, ingredient.name);
      if (typeof ingredient.optional !== 'boolean') {
        issues.push(`ingredients.${index}.optional: REQUIRED_BOOLEAN`);
      }
    });
  }

  requiredString('recipe.title', recipe.title);
  nonNegativeNumber('recipe.servings', recipe.servings, true);
  nonNegativeNumber('recipe.prepMinutes', recipe.prepMinutes);
  nonNegativeNumber('recipe.cookMinutes', recipe.cookMinutes);
  if (!difficulties.includes(recipe.difficulty as Difficulty)) {
    issues.push('recipe.difficulty: INVALID_ENUM');
  }
  if (!Array.isArray(recipe.steps)) {
    issues.push('recipe.steps: REQUIRED_ARRAY');
  } else {
    recipe.steps.forEach((raw, index) => {
      const step = object(raw);
      nonNegativeNumber(`recipe.steps.${index}.stepNumber`, step.stepNumber, true);
      requiredString(`recipe.steps.${index}.title`, step.title);
      requiredString(`recipe.steps.${index}.description`, step.description);
    });
  }
  return issues;
}

export const DishExtractionV11Schema = {
  parse(value: unknown): DishExtractionV11 {
    const issues = validateDishExtractionV11(value);
    if (issues.length) throw new DishExtractionValidationError(issues);
    return value as DishExtractionV11;
  },
  safeParse(value: unknown):
    | { success: true; data: DishExtractionV11 }
    | { success: false; error: DishExtractionValidationError } {
    const issues = validateDishExtractionV11(value);
    return issues.length
      ? { success: false, error: new DishExtractionValidationError(issues) }
      : { success: true, data: value as DishExtractionV11 };
  },
};
