import { Injectable } from '@nestjs/common';
import { DishExtractionV11, InvalidField, TargetedRepairRequest } from './ai-import.types';

const DEFAULT_REPAIR_PATHS = new Set([
  'basic.origin.regionCode',
  'basic.origin.provinceCode',
  'classification.categoryCodes',
  'classification.mealTypeCodes',
  'classification.goalCodes',
  'classification.dietTypeCodes',
  'classification.flavorCodes',
  'recipe.title',
  'recipe.steps',
  'recipe.servings',
]);

@Injectable()
export class TargetedRepairService {
  buildRequest(
    jobId: string,
    extraction: DishExtractionV11,
    invalidFields: InvalidField[],
  ): TargetedRepairRequest {
    const fields = invalidFields.filter((field) => DEFAULT_REPAIR_PATHS.has(field.path));
    return {
      jobId,
      dishContext: {
        name: extraction.basic.name,
        existingValidData: {
          schemaVersion: extraction.schemaVersion,
          basic: {
            name: extraction.basic.name,
            servings: extraction.basic.servings,
          },
          ingredients: extraction.ingredients.map(({ name, quantity, unitCode }) => ({
            name,
            quantity,
            unitCode,
          })),
        },
      },
      invalidFields: fields,
    };
  }

  merge(
    original: DishExtractionV11,
    patch: Record<string, unknown>,
    invalidFields: InvalidField[],
  ): DishExtractionV11 {
    const allowed = new Set(
      invalidFields
        .map((field) => field.path)
        .filter((path) => DEFAULT_REPAIR_PATHS.has(path)),
    );
    const result = structuredClone(original);
    for (const path of allowed) {
      const value = this.readPath(patch, path);
      if (value !== undefined) this.writePath(result as unknown as Record<string, unknown>, path, value);
    }
    return result;
  }

  private readPath(source: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((value, segment) => {
      if (value === null || typeof value !== 'object') return undefined;
      return (value as Record<string, unknown>)[segment];
    }, source);
  }

  private writePath(target: Record<string, unknown>, path: string, value: unknown): void {
    const segments = path.split('.');
    let cursor = target;
    for (const segment of segments.slice(0, -1)) {
      const next = cursor[segment];
      if (next === null || typeof next !== 'object' || Array.isArray(next)) return;
      cursor = next as Record<string, unknown>;
    }
    cursor[segments[segments.length - 1]] = structuredClone(value);
  }
}
