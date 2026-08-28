import { Injectable } from '@nestjs/common';
import {
  DishSourceAdapter,
  SourceExtraction,
  SourceExtractionRequest,
  SourceFieldClaim,
  SourceReference,
} from './source-adapter';

type JsonObject = Record<string, unknown>;

@Injectable()
export class JsonLdWebsiteAdapter implements DishSourceAdapter {
  readonly kind = 'WEBSITE' as const;

  supports(input: SourceExtractionRequest): boolean {
    const type = input.contentType?.toLowerCase();
    return (
      (!type || type.includes('html')) &&
      /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>/i.test(
        input.body,
      )
    );
  }

  async extract(input: SourceExtractionRequest): Promise<SourceExtraction> {
    const source: SourceReference = {
      kind: this.kind,
      uri: input.uri,
      retrievedAt: input.retrievedAt ?? new Date().toISOString(),
    };
    const warnings: string[] = [];
    const recipes = this.readRecipes(input.body, warnings);
    const claims = recipes.flatMap((recipe, index) =>
      this.toClaims(recipe, source, index),
    );

    return { source, claims, warnings };
  }

  private readRecipes(body: string, warnings: string[]): JsonObject[] {
    const recipes: JsonObject[] = [];
    const pattern =
      /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi;

    for (const match of body.matchAll(pattern)) {
      const raw = match[1].trim();
      if (!raw) continue;
      try {
        this.collectRecipes(JSON.parse(raw) as unknown, recipes);
      } catch {
        warnings.push('INVALID_JSON_LD_BLOCK');
      }
    }
    if (recipes.length === 0) warnings.push('NO_RECIPE_JSON_LD');
    return recipes;
  }

  private collectRecipes(value: unknown, output: JsonObject[]): void {
    if (Array.isArray(value)) {
      value.forEach((item) => this.collectRecipes(item, output));
      return;
    }
    if (!this.isObject(value)) return;
    if (this.hasRecipeType(value['@type'])) output.push(value);
    if (Array.isArray(value['@graph'])) {
      this.collectRecipes(value['@graph'], output);
    }
  }

  private toClaims(
    recipe: JsonObject,
    source: SourceReference,
    recipeIndex: number,
  ): SourceFieldClaim[] {
    const selector = `jsonld:Recipe[${recipeIndex}]`;
    const claims: SourceFieldClaim[] = [];
    const add = (fieldPath: string, value: unknown, confidence = 90) => {
      if (value !== undefined && value !== null && value !== '') {
        claims.push({ fieldPath, value, confidence, source, selector });
      }
    };

    add('basic.name', this.text(recipe.name), 95);
    add('basic.shortDescription', this.plainText(recipe.description));
    add('basic.prepMinutes', this.durationMinutes(recipe.prepTime));
    add('basic.cookMinutes', this.durationMinutes(recipe.cookTime));
    add('recipe.servings', this.servings(recipe.recipeYield));

    const ingredients = this.stringList(recipe.recipeIngredient).map(
      (rawText) => ({ rawText }),
    );
    add('ingredients', ingredients);

    const steps = this.instructions(recipe.recipeInstructions);
    add('recipe.steps', steps);

    const nutrition = this.isObject(recipe.nutrition)
      ? recipe.nutrition
      : undefined;
    if (nutrition) {
      add(
        'nutrition.caloriesKcal',
        this.numberFromText(nutrition.calories),
        85,
      );
      add('nutrition.proteinG', this.numberFromText(nutrition.proteinContent), 85);
      add(
        'nutrition.carbsG',
        this.numberFromText(nutrition.carbohydrateContent),
        85,
      );
      add('nutrition.fatG', this.numberFromText(nutrition.fatContent), 85);
      add('nutrition.fiberG', this.numberFromText(nutrition.fiberContent), 85);
      add('nutrition.sodiumMg', this.numberFromText(nutrition.sodiumContent), 85);
    }

    return claims;
  }

  private instructions(value: unknown): Array<{
    stepNumber: number;
    title: string;
    description: string;
  }> {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    return values
      .map((item, index) => {
        if (typeof item === 'string') {
          return {
            stepNumber: index + 1,
            title: `Bước ${index + 1}`,
            description: this.plainText(item) ?? '',
          };
        }
        if (!this.isObject(item)) return undefined;
        const description = this.plainText(item.text ?? item.description);
        if (!description) return undefined;
        return {
          stepNumber: index + 1,
          title: this.plainText(item.name) ?? `Bước ${index + 1}`,
          description,
        };
      })
      .filter((step): step is NonNullable<typeof step> => Boolean(step));
  }

  private durationMinutes(value: unknown): number | undefined {
    if (typeof value !== 'string') return undefined;
    const match = value.match(
      /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i,
    );
    if (!match) return undefined;
    return (
      Number(match[1] ?? 0) * 1440 +
      Number(match[2] ?? 0) * 60 +
      Number(match[3] ?? 0) +
      Math.ceil(Number(match[4] ?? 0) / 60)
    );
  }

  private servings(value: unknown): number | undefined {
    const parsed = this.numberFromText(
      Array.isArray(value) ? value[0] : value,
    );
    return parsed && parsed > 0 ? Math.round(parsed) : undefined;
  }

  private numberFromText(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string') return undefined;
    const match = value.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : undefined;
  }

  private stringList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => this.plainText(item))
      .filter((item): item is string => Boolean(item));
  }

  private plainText(value: unknown): string | undefined {
    const text = this.text(value);
    return text
      ?.replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private text(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim()
      ? value.trim()
      : undefined;
  }

  private hasRecipeType(value: unknown): boolean {
    return Array.isArray(value)
      ? value.some((type) => type === 'Recipe')
      : value === 'Recipe';
  }

  private isObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
