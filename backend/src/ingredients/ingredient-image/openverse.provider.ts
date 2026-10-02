import { Injectable, Logger } from '@nestjs/common';
import { INGREDIENT_HTTP_USER_AGENT } from './http-user-agent';
import { ConfigService } from '@nestjs/config';
import type {
  IngredientImageProvider,
  IngredientImageSearchHit,
} from './image-provider';

type OpenverseResult = {
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
  tags?: Array<{ name: string }>;
  source?: string;
};

@Injectable()
export class OpenverseProvider implements IngredientImageProvider {
  readonly name = 'openverse';
  private readonly logger = new Logger(OpenverseProvider.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Tìm ảnh trên Openverse. Chạy 2 truy vấn: theo tag (chính xác) rồi theo từ khóa tự do.
   * Lưu ý: Openverse không hỗ trợ toán tử phủ định ("-logo") trong q, thêm vào sẽ làm rỗng kết quả.
   */
  async search(query: string, limit = 8): Promise<IngredientImageSearchHit[]> {
    const clean = query.trim();
    if (!clean) return [];

    const seen = new Set<string>();
    const hits: IngredientImageSearchHit[] = [];

    const tagResults = await this.request({ tags: clean.toLowerCase() }, limit);
    for (const r of tagResults) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      hits.push(this.toHit(r));
    }

    if (hits.length < limit) {
      const qResults = await this.request({ q: clean }, limit);
      for (const r of qResults) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        hits.push(this.toHit(r));
      }
    }

    return hits.slice(0, limit * 2);
  }

  private async request(
    params: Record<string, string>,
    limit: number,
  ): Promise<OpenverseResult[]> {
    const url = new URL('https://api.openverse.org/v1/images/');
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set('page_size', String(Math.min(Math.max(limit, 1), 20)));
    url.searchParams.set('license_type', 'commercial,modification');
    url.searchParams.set('category', 'photograph');
    url.searchParams.set('mature', 'false');

    try {
      const res = await fetch(url.toString(), {
        headers: {
          'user-agent': INGREDIENT_HTTP_USER_AGENT,
          accept: 'application/json',
        },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) {
        this.logger.debug(`Openverse ${res.status} for ${JSON.stringify(params)}`);
        return [];
      }
      const json = (await res.json()) as { results?: OpenverseResult[] };
      return json.results ?? [];
    } catch (err) {
      this.logger.warn(`Openverse search failed: ${(err as Error).message}`);
      return [];
    }
  }

  private toHit(r: OpenverseResult): IngredientImageSearchHit {
    const tags = (r.tags ?? []).map((t) => t.name).filter(Boolean).slice(0, 20);
    return {
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
      tags,
      tier: 'D',
    };
  }
}
