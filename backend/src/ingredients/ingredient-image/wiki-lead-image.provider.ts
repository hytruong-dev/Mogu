import { Injectable, Logger } from '@nestjs/common';
import { INGREDIENT_HTTP_USER_AGENT } from './http-user-agent';
import type { ResolvedIngredientEntity } from '../ingredient-entity/ingredient-entity-resolver.service';
import type {
  IngredientImageProvider,
  IngredientImageSearchHit,
} from './image-provider';

@Injectable()
export class WikiLeadImageProvider implements IngredientImageProvider {
  readonly name = 'wikipedia_lead';
  private readonly logger = new Logger(WikiLeadImageProvider.name);
  private readonly userAgent = INGREDIENT_HTTP_USER_AGENT;

  async search(_query: string, _limit = 5): Promise<IngredientImageSearchHit[]> {
    return [];
  }

  /**
   * Lấy ảnh chính diện từ vi.wikipedia (lead image) và Wikidata (P18) đã được xác nhận thực thể.
   * Đây là nguồn Tier A: độ tin cậy và khớp thực thể cao nhất.
   */
  async searchByEntity(
    entity: ResolvedIngredientEntity,
    limit = 6,
  ): Promise<IngredientImageSearchHit[]> {
    const fileTitles = new Set<string>();
    const fileOrigins = new Map<string, 'wikipedia_lead' | 'wikidata_p18'>();

    const addFile = (
      raw: string,
      origin: 'wikipedia_lead' | 'wikidata_p18',
    ) => {
      const clean = raw.trim().replace(/_/g, ' ');
      if (!clean) return;
      const canonical = clean.startsWith('File:') ? clean : `File:${clean}`;
      if (!fileTitles.has(canonical)) {
        fileTitles.add(canonical);
        fileOrigins.set(canonical, origin);
      }
    };

    // 1. Lấy ảnh lead từ vi.wikipedia (ưu tiên) rồi en.wikipedia
    for (const lead of [entity.leadImage, entity.leadImageEn]) {
      if (!lead?.source) continue;
      const extracted = this.extractFileNameFromUrl(lead.source);
      if (extracted) addFile(extracted, 'wikipedia_lead');
    }

    // 2. Lấy các ảnh P18 từ Wikidata
    for (const p18 of entity.p18Files) {
      if (fileTitles.size >= limit) break;
      addFile(p18, 'wikidata_p18');
    }

    if (!fileTitles.size) return [];

    try {
      const titlesParam = Array.from(fileTitles).join('|');
      const url = new URL('https://commons.wikimedia.org/w/api.php');
      url.searchParams.set('action', 'query');
      url.searchParams.set('format', 'json');
      url.searchParams.set('titles', titlesParam);
      url.searchParams.set('prop', 'imageinfo');
      url.searchParams.set('iiprop', 'url|size|mime|extmetadata|user');
      url.searchParams.set('iiurlwidth', '640');

      const res = await fetch(url.toString(), {
        headers: { 'user-agent': this.userAgent },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) return [];

      const json = (await res.json()) as {
        query?: {
          pages?: Record<
            string,
            {
              pageid: number;
              title: string;
              imageinfo?: Array<{
                url: string;
                descriptionurl: string;
                thumburl?: string;
                width?: number;
                height?: number;
                mime?: string;
                user?: string;
                extmetadata?: Record<string, { value?: string } | undefined>;
              }>;
            }
          >;
        };
      };

      const pages = Object.values(json.query?.pages ?? {});
      const hits: IngredientImageSearchHit[] = [];

      for (const page of pages) {
        const info = page.imageinfo?.[0];
        if (!info?.url || !info.descriptionurl) continue;

        const meta = info.extmetadata ?? {};
        const licenseCode =
          meta.LicenseShortName?.value ||
          meta.License?.value ||
          'UNKNOWN';
        const licenseUrl = meta.LicenseUrl?.value;
        const artistHtml = meta.Artist?.value ?? info.user;
        const author = artistHtml
          ? artistHtml.replace(/<[^>]+>/g, '').trim()
          : undefined;
        const description = meta.ImageDescription?.value
          ? meta.ImageDescription.value.replace(/<[^>]+>/g, '').trim()
          : undefined;

        const providerName = fileOrigins.get(page.title) || this.name;

        hits.push({
          provider: providerName,
          providerAssetId: String(page.pageid || page.title),
          sourcePageUrl: info.descriptionurl,
          originalUrl: info.url,
          previewUrl: info.thumburl || info.url,
          author,
          licenseCode: String(licenseCode).substring(0, 100),
          licenseUrl,
          width: info.width,
          height: info.height,
          mimeType: info.mime,
          title: page.title.replace(/^File:/i, ''),
          description,
          tier: 'A',
          entityMatch: true,
        });
      }

      return hits;
    } catch (err) {
      this.logger.warn(`searchByEntity failed: ${(err as Error).message}`);
      return [];
    }
  }

  /**
   * Trích tên tệp Commons từ URL upload/thumb.
   * - https://upload.wikimedia.org/wikipedia/commons/6/60/Standing-rib-roast.jpg -> Standing-rib-roast.jpg
   * - https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Standing-rib-roast.jpg/330px-Standing-rib-roast.jpg -> Standing-rib-roast.jpg
   * - https://upload.wikimedia.org/wikipedia/vi/x/xx/Local.jpg -> null (ảnh không ở Commons)
   */
  extractFileNameFromUrl(rawUrl: string): string | null {
    try {
      const url = new URL(rawUrl);
      const pathname = decodeURIComponent(url.pathname);
      const thumbMatch = pathname.match(
        /\/wikipedia\/commons\/thumb\/[0-9a-f]\/[0-9a-f]{2}\/([^/]+)\//i,
      );
      if (thumbMatch?.[1]) return thumbMatch[1];
      const directMatch = pathname.match(
        /\/wikipedia\/commons\/[0-9a-f]\/[0-9a-f]{2}\/([^/]+)$/i,
      );
      if (directMatch?.[1]) return directMatch[1];
      if (/\/wikipedia\/commons\//i.test(pathname)) {
        const parts = pathname.split('/').filter(Boolean);
        return parts[parts.length - 1] || null;
      }
      return null;
    } catch {
      return null;
    }
  }
}
