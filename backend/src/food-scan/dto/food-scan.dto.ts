import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export type FoodCategory =
  | 'soup_noodle'
  | 'dry_noodle'
  | 'rice'
  | 'bread'
  | 'snack'
  | 'dessert'
  | 'drink'
  | 'other';

export interface FoodScanGuess {
  nameVi: string;
  nameEn: string | null;
  confidence: number;
}

export interface FoodScanExtraction {
  primaryName: string | null;
  alternateNames: string[];
  guesses: FoodScanGuess[];
  category: FoodCategory | null;
  cuisine: string | null;
  visibleIngredients: string[];
  isFood: boolean;
  quality: 'GOOD' | 'POOR';
}

export interface FoodScanCandidate {
  dishId: string;
  name: string;
  imageUrl: string | null;
  /** Composite score combining rerank confidence, RRF norm, and ingredient precision. */
  score: number;
  matchSource?: 'PHASH' | 'RRF' | 'RERANK' | 'LEXICAL';
  confidenceLabel?: 'HIGH' | 'MEDIUM' | 'LOW';
  nutrition: {
    calories: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    servingName: string | null;
    servingG: number | null;
    basis: string | null;
  };
}

export type FoodScanStatus =
  | 'MATCHED'
  | 'SUGGESTIONS'
  /** Food, but the dish is not in the catalog (reported to admins). */
  | 'UNKNOWN_DISH'
  /** Food, but retrieval found no candidate at all (also reported). */
  | 'NO_MATCH'
  | 'NOT_FOOD';

export interface FoodScanResponse {
  scanId: string;
  status: FoodScanStatus;
  recognizedName: string | null;
  confidence: number;
  matchSource?: 'PHASH' | 'RRF' | 'RERANK' | 'LEXICAL';
  candidates: FoodScanCandidate[];
  model: string;
  /** Set when the scan was queued for admins as a missing dish. */
  reportId?: string;
}

/** Evidence about the top candidate used to decide MATCHED vs UNKNOWN_DISH. */
export interface FoodScanEvidence {
  /** Closed-set rerank actually answered (not disabled / failed). */
  rerankRan: boolean;
  /** 1-based index chosen by rerank, null = "none of the candidates". */
  rerankBestIndex: number | null;
  /** Top candidate came from a confirmed near-duplicate photo. */
  topIsPhash: boolean;
  /** Best lexical (name) similarity of the top candidate, 0 when none. */
  topLexicalScore: number;
}

export class FoodScanFeedbackDto {
  @IsOptional()
  @IsUUID()
  dishId?: string | null;

  @IsBoolean()
  correct!: boolean;
}
