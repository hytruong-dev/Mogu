import { Injectable, Logger } from '@nestjs/common';
import { INGREDIENT_HTTP_USER_AGENT } from './http-user-agent';
import type {
  IngredientImageProvider,
  IngredientImageSearchHit,
} from './image-provider';

@Injectable()
export class CommonsCategoryProvider implements IngredientImageProvider {
  readonly name = 'commons_category';
  private readonly logger = new Logger(CommonsCategoryProvider.name);
  private readonly userAgent = INGREDIENT_HTTP_USER_AGENT;

  async search(_query: string, _limit = 8): Promise<IngredientImageSearchHit[]> {
    return [];
  }

  /**
   * Lấy các tệp ảnh trong Wikimedia Commons Category tương ứng (lấy từ Wikidata P373).
   * Ví dụ: Category:Chili peppers hoặc Category:Sugars.
   */
  async searchByCategory(
    categoryName: string,
    limit = 8,
  ): Promise<IngredientImageSearchHit[]> {
    const cleanCategory = categoryName.trim().replace(/^Category:/i, '');
    if (!cleanCategory) return [];

    try {
      const url = new URL('https://commons.wikimedia.org/w/api.php');
      url.searchParams.set('action', 'query');
      url.searchParams.set('format', 'json');
      url.searchParams.set('generator', 'categorymembers');
      url.searchParams.set('gcmtitle', `Category:${cleanCategory}`);
      url.searchParams.set('gcmtype', 'file');
      url.searchParams.set('gcmlimit', String(Math.min(limit * 2, 20)));
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

        // Bỏ qua các tệp âm thanh hoặc không phải ảnh bitmap
        const mime = (info.mime || '').toLowerCase();
        if (!mime.startsWith('image/') || mime.includes('svg')) continue;

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

        hits.push({
          provider: this.name,
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
          tier: 'C',
        });

        if (hits.length >= limit) break;
      }

      return hits;
    } catch (err) {
      this.logger.warn(`searchByCategory("${categoryName}") failed: ${(err as Error).message}`);
      return [];
    }
  }
}
