import { DishExtractionV11, TargetedRepairRequest, TaxonomySnapshot } from './ai-import.types';

export interface DishExtractionRequest {
  dishName: string;
  regionName?: string;
  relatedKeywords?: string[];
  taxonomy: TaxonomySnapshot;
}

export interface AiImportProvider {
  extractDish(request: DishExtractionRequest): Promise<DishExtractionV11>;
  repairFields(request: TargetedRepairRequest): Promise<Record<string, unknown>>;
}

export const AI_IMPORT_PROVIDER = Symbol('AI_IMPORT_PROVIDER');
