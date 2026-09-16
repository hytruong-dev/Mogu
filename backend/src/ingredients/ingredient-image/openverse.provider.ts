import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  IngredientImageProvider,
  IngredientImageSearchHit,
} from './image-provider';

@Injectable()
export class OpenverseProvider implements IngredientImageProvider {
  readonly name = 'openverse';
  private readonly logger = new Logger(OpenverseProvider.name);

  constructor(private readonly config: ConfigService) {}

  async search(query: string, limit = 8): Promise<IngredientImageSearchHit[]> {
    const url = new URL('https://api.openverse.org/v1/images/');
    url.searchParams.set('q', `${query} ingredient food`);
    url.searchParams.set('page_size', String(Math.min(limit, 10)));
    url.searchParams.set('license_type', 'commercial,modification');
    url.searchParams.set('category', 'photograph');

    try {
      const res = await fetch(url.toString(), {
        headers: {
          'user-agent': 'Mogu-IngredientEnrichment/1.0',
          accept: 'application/json',
        },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) return [];
      const json = (await res.json()) as {
        results?: Array<{
          id: string;
          title?: string;
          url: string;
          foreign_landing_url?: string;
          thumbnail?: string;
          creator?: string;
          creator_url?: string;
          license?: string;
          license_url?: string;
          width?: number;
          height?: number;
        }>;
      };

      return (json.results ?? []).map((r) => ({
        provider: this.name,
        providerAssetId: r.id,
        sourcePageUrl: r.foreign_landing_url || r.url,
        originalUrl: r.url,
        previewUrl: r.thumbnail,
        author: r.creator,
        authorUrl: r.creator_url,
        licenseCode: (r.license || 'UNKNOWN').substring(0, 100),
        licenseUrl: r.license_url,
        width: r.width,
        height: r.height,
        title: r.title,
      }));
    } catch (err) {
      this.logger.warn(`Openverse search failed: ${(err as Error).message}`);
      return [];
    }
  }
}
