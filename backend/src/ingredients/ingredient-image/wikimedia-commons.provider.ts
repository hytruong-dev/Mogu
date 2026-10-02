import { Injectable, Logger } from '@nestjs/common';
import { INGREDIENT_HTTP_USER_AGENT } from './http-user-agent';
import type {
  IngredientImageProvider,
  IngredientImageSearchHit,
} from './image-provider';

@Injectable()
export class WikimediaCommonsProvider implements IngredientImageProvider {
  readonly name = 'wikimedia_commons';
  private readonly logger = new Logger(WikimediaCommonsProvider.name);

  async search(query: string, limit = 8): Promise<IngredientImageSearchHit[]> {
    const clean = query.trim();
    if (!clean) return [];
    // Ưu tiên tệp có tên chứa từ khóa, giới hạn ảnh bitmap; loại các từ khóa hay gây nhiễu
    const q = `intitle:"${clean}" filemime:image/jpeg -intitle:restaurant -intitle:menu -intitle:shop -intitle:market`;
    const searchUrl = new URL('https://commons.wikimedia.org/w/api.php');
    searchUrl.searchParams.set('action', 'query');
    searchUrl.searchParams.set('format', 'json');
    searchUrl.searchParams.set('generator', 'search');
    searchUrl.searchParams.set('gsrsearch', q);
    searchUrl.searchParams.set('gsrnamespace', '6');
    searchUrl.searchParams.set('gsrlimit', String(Math.min(limit, 10)));
    searchUrl.searchParams.set('prop', 'imageinfo');
    searchUrl.searchParams.set(
      'iiprop',
      'url|size|mime|extmetadata|user',
    );
    searchUrl.searchParams.set('iiurlwidth', '640');

    try {
      const res = await fetch(searchUrl.toString(), {
        headers: { 'user-agent': INGREDIENT_HTTP_USER_AGENT },
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
                extmetadata?: Record<
                  string,
                  { value?: string } | undefined
                >;
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
          ? meta.ImageDescription.value.replace(/<[^>]+>/g, '').trim().slice(0, 300)
          : undefined;

        hits.push({
          provider: this.name,
          providerAssetId: String(page.pageid),
          sourcePageUrl: info.descriptionurl,
          originalUrl: info.url,
          previewUrl: info.thumburl,
          author,
          licenseCode: String(licenseCode).substring(0, 100),
          licenseUrl,
          width: info.width,
          height: info.height,
          mimeType: info.mime,
          title: page.title.replace(/^File:/i, ''),
          description,
          tier: 'D',
        });
      }
      return hits;
    } catch (err) {
      this.logger.warn(`Wikimedia search failed: ${(err as Error).message}`);
      return [];
    }
  }
}
