import { Injectable } from '@nestjs/common';

export interface DuplicateDishProfile {
  id?: string;
  name: string;
  alternateNames?: string[];
  regionCode?: string | null;
  provinceCode?: string | null;
  categoryCodes?: string[];
  mainIngredients?: string[];
  recipeTokens?: string[];
  status?: string;
}

export interface DuplicateScore {
  candidateId?: string;
  score: number;
  decision: 'NONE' | 'REVIEW' | 'LIKELY_DUPLICATE';
  signals: Record<
    'name' | 'origin' | 'category' | 'ingredients' | 'recipe',
    number
  >;
  protectedPublishedCandidate: boolean;
}

@Injectable()
export class DuplicateScoringService {
  score(
    incoming: DuplicateDishProfile,
    candidate: DuplicateDishProfile,
  ): DuplicateScore {
    const incomingNames = [incoming.name, ...(incoming.alternateNames ?? [])];
    const candidateNames = [candidate.name, ...(candidate.alternateNames ?? [])];
    const name = Math.max(
      ...incomingNames.flatMap((left) =>
        candidateNames.map((right) => this.textSimilarity(left, right)),
      ),
    );
    const origin = this.originSimilarity(incoming, candidate);
    const category = this.jaccard(
      incoming.categoryCodes,
      candidate.categoryCodes,
    );
    const ingredients = this.jaccard(
      incoming.mainIngredients,
      candidate.mainIngredients,
    );
    const recipe = this.jaccard(incoming.recipeTokens, candidate.recipeTokens);
    const score = Math.round(
      (name * 0.4 +
        origin * 0.15 +
        category * 0.15 +
        ingredients * 0.2 +
        recipe * 0.1) *
        100,
    );

    return {
      candidateId: candidate.id,
      score,
      decision:
        score >= 85 ? 'LIKELY_DUPLICATE' : score >= 70 ? 'REVIEW' : 'NONE',
      signals: { name, origin, category, ingredients, recipe },
      protectedPublishedCandidate: candidate.status === 'PUBLISHED',
    };
  }

  rank(
    incoming: DuplicateDishProfile,
    candidates: DuplicateDishProfile[],
  ): DuplicateScore[] {
    return candidates
      .map((candidate) => this.score(incoming, candidate))
      .sort((a, b) => b.score - a.score);
  }

  private originSimilarity(
    left: DuplicateDishProfile,
    right: DuplicateDishProfile,
  ): number {
    if (
      left.provinceCode &&
      right.provinceCode &&
      left.provinceCode === right.provinceCode
    )
      return 1;
    if (
      left.regionCode &&
      right.regionCode &&
      left.regionCode === right.regionCode
    )
      return 0.75;
    return 0;
  }

  private textSimilarity(left: string, right: string): number {
    const a = new Set(this.tokens(left));
    const b = new Set(this.tokens(right));
    return this.jaccardSets(a, b);
  }

  private jaccard(left?: string[], right?: string[]): number {
    const a = new Set((left ?? []).flatMap((value) => this.tokens(value)));
    const b = new Set((right ?? []).flatMap((value) => this.tokens(value)));
    return this.jaccardSets(a, b);
  }

  private jaccardSets(left: Set<string>, right: Set<string>): number {
    if (left.size === 0 || right.size === 0) return 0;
    const intersection = [...left].filter((value) => right.has(value)).length;
    return intersection / new Set([...left, ...right]).size;
  }

  private tokens(value: string): string[] {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/đ/g, 'd')
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
  }
}
