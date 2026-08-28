export type ImportSourceKind =
  | 'AI_GENERATED'
  | 'WEBSITE'
  | 'VIDEO'
  | 'NUTRITION_DATABASE';

export interface SourceReference {
  kind: ImportSourceKind;
  uri: string;
  title?: string;
  publisher?: string;
  retrievedAt: string;
}

export interface SourceFieldClaim {
  fieldPath: string;
  value: unknown;
  confidence: number;
  source: SourceReference;
  selector?: string;
}

export interface SourceExtraction {
  source: SourceReference;
  claims: SourceFieldClaim[];
  warnings: string[];
}

export interface SourceExtractionRequest {
  uri: string;
  contentType?: string;
  body: string;
  retrievedAt?: string;
}

/**
 * Adapters parse content already fetched by a hardened fetcher. They never
 * perform network I/O, which keeps SSRF and redirect policy outside parsers.
 */
export interface DishSourceAdapter {
  readonly kind: ImportSourceKind;
  supports(input: SourceExtractionRequest): boolean;
  extract(input: SourceExtractionRequest): Promise<SourceExtraction>;
}

export interface SourceIntegrationFlags {
  websiteJsonLd: boolean;
  nutritionDatabases: boolean;
}

export const DEFAULT_SOURCE_INTEGRATION_FLAGS: Readonly<SourceIntegrationFlags> =
  Object.freeze({
    websiteJsonLd: false,
    nutritionDatabases: false,
  });
