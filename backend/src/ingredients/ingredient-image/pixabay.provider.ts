import { Injectable, Logger } from '@nestjs/common';
import { INGREDIENT_HTTP_USER_AGENT } from './http-user-agent';
import { ConfigService } from '@nestjs/config';
import type {
  IngredientImageProvider,
  IngredientImageSearchHit,
} from './image-provider';

@Injectable()
export class PixabayProvider implements IngredientImageProvider {
  readonly name = 'pixabay';
  private readonly logger = new Logger(PixabayProvider.name);
  private readonly apiKey: string | null = null;

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('PIXABAY_API_KEY')?.trim();
    if (key) {
      this.apiKey = key;
    } else {
      this.logger.debug('PIXABAY_API_KEY is not set. Pixabay search will be skipped.');
    }
  }

  async search(query: string, limit = 8): Promise<IngredientImageSearchHit[]> {
    return this.searchWithLanguage(query, 'vi', limit);
  }

  async searchMultiLanguage(
    queryVi: string,
    queryEn?: string,
    limit = 8,
  ): Promise<IngredientImageSearchHit[]> {
    if (!this.apiKey) return [];

    const hits: IngredientImageSearchHit[] = [];
    const seenIds = new Set<string>();

    // 1. Tìm bằng tiếng Việt
    if (queryVi) {
      const viHits = await this.searchWithLanguage(queryVi, 'vi', limit);
      for (const h of viHits) {
        if (!seenIds.has(h.providerAssetId)) {
          seenIds.add(h.providerAssetId);
          hits.push(h);
        }
      }
    }

    // 2. Nếu chưa đủ limit, tìm tiếp bằng tiếng Anh
    if (hits.length < limit && queryEn && queryEn.toLowerCase() !== queryVi.toLowerCase()) {
      const enHits = await this.searchWithLanguage(queryEn, 'en', limit - hits.length);
      for (const h of enHits) {
        if (!seenIds.has(h.providerAssetId)) {
          seenIds.add(h.providerAssetId);
          hits.push(h);
        }
      }
    }

    return hits;
  }

  private async searchWithLanguage(
    query: string,
    lang: 'vi' | 'en',
    limit = 8,
  ): Promise<IngredientImageSearchHit[]> {
    if (!this.apiKey) return [];
    const cleanQuery = query.trim().substring(0, 95);
    if (!cleanQuery) return [];

    try {
      const url = new URL('https://pixabay.com/api/');
      url.searchParams.set('key', this.apiKey);
      url.searchParams.set('q', cleanQuery);
      url.searchParams.set('lang', lang);
      url.searchParams.set('image_type', 'photo');
      url.searchParams.set('category', 'food');
      url.searchParams.set('safesearch', 'true');
      url.searchParams.set('per_page', String(Math.min(limit, 10)));

      const res = await fetch(url.toString(), {
        headers: { 'user-agent': INGREDIENT_HTTP_USER_AGENT },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) return [];

      const json = (await res.json()) as {
        hits?: Array<{
          id: number;
          pageURL: string;
          previewURL?: string;
          webformatURL?: string;
          largeImageURL?: string;
          imageWidth?: number;
          imageHeight?: number;
          tags?: string;
          user?: string;
        }>;
      };

      return (json.hits ?? []).map((item) => {
        const tags = (item.tags ?? '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
        const originalUrl = item.largeImageURL || item.webformatURL || item.pageURL;
        return {
          provider: this.name,
          providerAssetId: String(item.id),
          sourcePageUrl: item.pageURL,
          originalUrl,
          previewUrl: item.previewURL || item.webformatURL,
          author: item.user,
          licenseCode: 'Pixabay License',
          licenseUrl: 'https://pixabay.com/service/license-summary/',
          width: item.imageWidth,
          height: item.imageHeight,
          title: tags.join(', ') || cleanQuery,
          tags,
          tier: 'B',
        };
      });
    } catch (err) {
      this.logger.warn(`Pixabay search failed for "${query}" (${lang}): ${(err as Error).message}`);
      return [];
    }
  }
}
