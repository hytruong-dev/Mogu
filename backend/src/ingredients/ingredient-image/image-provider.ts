export interface IngredientImageSearchHit {
  provider: string;
  providerAssetId: string;
  sourcePageUrl: string;
  originalUrl: string;
  previewUrl?: string;
  author?: string;
  authorUrl?: string;
  licenseCode: string;
  licenseUrl?: string;
  width?: number;
  height?: number;
  mimeType?: string;
  title?: string;
  description?: string;
}

export interface IngredientImageProvider {
  readonly name: string;
  search(query: string, limit?: number): Promise<IngredientImageSearchHit[]>;
}
