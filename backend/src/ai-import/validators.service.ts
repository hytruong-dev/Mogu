import { Injectable } from '@nestjs/common';
import {
  DishExtractionV11,
  ExtractedRecipe,
  FieldWarning,
  IngredientResolution,
  TaxonomySnapshot,
} from './ai-import.types';
import { TaxonomySnapshotService } from './taxonomy-snapshot.service';

const stripFormatting = (value: string): string =>
  value
    .normalize('NFC')
    .replace(/<[^>]*>/g, '')
    .replace(/[*_`~>#]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const comparable = (value: string): string =>
  stripFormatting(value)
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

@Injectable()
export class RecipeValidatorService {
  sanitize(recipe: ExtractedRecipe, dishName: string): ExtractedRecipe {
    const title = stripFormatting(recipe.title);
    return {
      ...recipe,
      title: this.titleMatchesDish(title, dishName)
        ? title
        : `Cách làm ${stripFormatting(dishName)}`,
      steps: recipe.steps.map((step, index) => ({
        ...step,
        stepNumber: index + 1,
        title: stripFormatting(step.title) || `Bước ${index + 1}`,
        description: stripFormatting(step.description),
        tips: step.tips ? stripFormatting(step.tips) : null,
      })),
    };
  }

  titleMatchesDish(title: string, dishName: string): boolean {
    const normalizedTitle = comparable(title);
    const normalizedDish = comparable(dishName);
    if (!normalizedTitle || !normalizedDish) return false;
    if (normalizedTitle.includes(normalizedDish)) return true;
    const dishWords = normalizedDish.split(' ').filter((word) => word.length > 1);
    return dishWords.length > 0 &&
      dishWords.filter((word) => normalizedTitle.includes(word)).length /
        dishWords.length >= 0.7;
  }
}

@Injectable()
export class CrossFieldValidatorService {
  constructor(
    private readonly taxonomy: TaxonomySnapshotService,
    private readonly recipeValidator: RecipeValidatorService,
  ) {}

  validate(
    extraction: DishExtractionV11,
    snapshot: TaxonomySnapshot,
    resolutions: IngredientResolution[] = [],
  ): FieldWarning[] {
    const warnings: FieldWarning[] = [];
    const add = (
      code: string,
      fieldPath: string,
      message: string,
      severity: FieldWarning['severity'],
    ) => warnings.push({ code, fieldPath, message, severity });

    const nameLength = extraction.basic.name.trim().length;
    if (nameLength < 2 || nameLength > 150) {
      add('INVALID_DISH_NAME', 'basic.name', 'Tên món phải dài 2–150 ký tự.', 'BLOCKING');
    }
    const origin = extraction.basic.origin;
    if (
      origin.regionCode &&
      origin.provinceCode &&
      !this.taxonomy.provinceBelongsToRegion(
        origin.provinceCode,
        origin.regionCode,
        snapshot,
      )
    ) add(
      'AI_IMPORT_PROVINCE_REGION_MISMATCH',
      'basic.origin.provinceCode',
      'Tỉnh/thành không thuộc vùng miền đã chọn.',
      'BLOCKING',
    );

    this.validateRequiredTaxonomy(
      extraction.classification.categoryCodes,
      snapshot.categories,
      'classification.categoryCodes',
      warnings,
    );
    this.validateRequiredTaxonomy(
      extraction.classification.mealTypeCodes,
      snapshot.mealTypes,
      'classification.mealTypeCodes',
      warnings,
    );
    if (!this.recipeValidator.titleMatchesDish(
      extraction.recipe.title,
      extraction.basic.name,
    )) add(
      'TITLE_DISH_MISMATCH',
      'recipe.title',
      'Tiêu đề công thức không khớp tên món.',
      'BLOCKING',
    );
    if (!extraction.recipe.steps.length) {
      add('EMPTY_RECIPE_STEPS', 'recipe.steps', 'Công thức phải có ít nhất một bước.', 'BLOCKING');
    }
    if (extraction.recipe.servings !== extraction.basic.servings) {
      add('SERVINGS_MISMATCH', 'recipe.servings', 'Khẩu phần món và công thức không khớp.', 'BLOCKING');
    }
    resolutions.forEach((resolution, index) => {
      if (!resolution.matchedIngredientId || resolution.confidence < 90) {
        add(
          'AI_IMPORT_INGREDIENT_UNRESOLVED',
          `ingredients.${index}.name`,
          'Nguyên liệu chưa được đối chiếu đủ tin cậy.',
          'WARNING',
        );
      }
    });
    return warnings;
  }

  private validateRequiredTaxonomy(
    codes: string[],
    items: Array<{ code: string }>,
    fieldPath: string,
    warnings: FieldWarning[],
  ) {
    if (!codes.length) {
      warnings.push({
        code: 'EMPTY_REQUIRED_FIELD',
        fieldPath,
        message: 'Phân loại bắt buộc chưa có giá trị.',
        severity: 'REVIEW_BLOCKING',
      });
      return;
    }
    const valid = new Set(items.map((item) => item.code.toUpperCase()));
    for (const code of codes) {
      if (!valid.has(code.toUpperCase())) {
        warnings.push({
          code: 'AI_IMPORT_UNKNOWN_TAXONOMY_CODE',
          fieldPath,
          message: `Taxonomy code không hợp lệ: ${code}.`,
          severity: 'REVIEW_BLOCKING',
        });
      }
    }
  }
}
