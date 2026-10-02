import {
  DishExtractionV11,
  RecipeEvidence,
  TargetedRepairRequest,
  TaxonomySnapshot,
} from './ai-import.types';

export interface DishExtractionRequest {
  dishName: string;
  regionName?: string;
  relatedKeywords?: string[];
  taxonomy: TaxonomySnapshot;
  /** Công thức từ nguồn uy tín (nếu tìm được) — AI phải bám theo nguồn. */
  evidence?: RecipeEvidence | null;
}

export interface IngredientAdjudicationCandidate {
  id: string;
  name: string;
  synonyms?: string[];
  score: number;
}

export interface IngredientAdjudicationItem {
  /** Tham chiếu để map ngược (vd "ai-3"). */
  ref: string;
  /** Tên nguyên liệu do AI/parser sinh ra (đã làm sạch). */
  name: string;
  /** Chuỗi gốc có số lượng/sơ chế để AI hiểu ngữ cảnh. */
  rawText?: string;
  candidates: IngredientAdjudicationCandidate[];
}

export interface IngredientAdjudicationRequest {
  dishName: string;
  /** Toàn bộ nguyên liệu của món (để AI tránh tách trùng trong cùng món). */
  allIngredientNames: string[];
  items: IngredientAdjudicationItem[];
}

export interface IngredientAdjudicationDecision {
  ref: string;
  /** id ứng viên được xác nhận là CÙNG nguyên liệu; null nếu thực sự khác. */
  matchId: string | null;
  confidence: number;
  /** Tên gọi khác (tiếng Việt) mà AI biết — dùng để học synonyms. */
  synonyms: string[];
  reason?: string;
}

export interface AiImportProvider {
  extractDish(request: DishExtractionRequest): Promise<DishExtractionV11>;
  repairFields(request: TargetedRepairRequest): Promise<Record<string, unknown>>;
  adjudicateIngredientMatches(
    request: IngredientAdjudicationRequest,
  ): Promise<IngredientAdjudicationDecision[]>;
}

export const AI_IMPORT_PROVIDER = Symbol('AI_IMPORT_PROVIDER');
