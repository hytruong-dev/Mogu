import { Inject, Injectable } from '@nestjs/common';
import { SourceReference } from '../sources/source-adapter';

export interface NutritionIngredientQuery {
  canonicalName: string;
  amountGram?: number | null;
  locale?: string;
}

export interface NutritionNutrients {
  caloriesKcal?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  fiberG?: number | null;
  sodiumMg?: number | null;
}

export interface NutritionSourceMatch {
  sourceFoodId: string;
  sourceFoodName: string;
  basisGram: number;
  nutrients: NutritionNutrients;
  confidence: number;
  source: SourceReference;
}

/**
 * Contract for vetted providers such as USDA or a Vietnamese food table.
 * Implementations own authentication/rate limiting; callers must not label
 * results SOURCE_VERIFIED unless a concrete match and source are returned.
 */
export interface NutritionSourceAdapter {
  readonly providerCode: string;
  isEnabled(): boolean;
  lookup(
    query: NutritionIngredientQuery,
  ): Promise<NutritionSourceMatch[]>;
}

export const NUTRITION_SOURCE_ADAPTERS = Symbol('NUTRITION_SOURCE_ADAPTERS');

export class DisabledNutritionSourceAdapter
  implements NutritionSourceAdapter
{
  constructor(readonly providerCode: string) {}

  isEnabled(): boolean {
    return false;
  }

  async lookup(): Promise<NutritionSourceMatch[]> {
    return [];
  }
}

@Injectable()
export class NutritionSourceRegistry {
  constructor(
    @Inject(NUTRITION_SOURCE_ADAPTERS)
    private readonly adapters: readonly NutritionSourceAdapter[] = [],
  ) {}

  enabled(): NutritionSourceAdapter[] {
    return this.adapters.filter((adapter) => adapter.isEnabled());
  }

  async lookup(
    query: NutritionIngredientQuery,
  ): Promise<NutritionSourceMatch[]> {
    const results = await Promise.all(
      this.enabled().map((adapter) => adapter.lookup(query)),
    );
    return results.flat().sort((a, b) => b.confidence - a.confidence);
  }
}
