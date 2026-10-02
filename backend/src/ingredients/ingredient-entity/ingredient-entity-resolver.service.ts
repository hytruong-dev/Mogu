import { Injectable, Logger } from '@nestjs/common';
import { INGREDIENT_HTTP_USER_AGENT } from '../ingredient-image/http-user-agent';

export interface ResolvedIngredientEntity {
  wikidataId?: string;
  viTitle?: string;
  enTitle?: string;
  descriptionVi?: string;
  extractVi?: string;
  aliasesVi: string[];
  commonsCategory?: string;
  p18Files: string[];
  leadImage?: {
    source: string;
    width?: number;
    height?: number;
    title?: string;
  };
  /** Ảnh lead lấy từ en.wikipedia (fallback khi vi.wikipedia không có) */
  leadImageEn?: {
    source: string;
    width?: number;
    height?: number;
    title?: string;
  };
  offTag?: string;
  offParents?: string[];
  sources: Array<{ name: string; url: string }>;
}

type WikiSummary = {
  type?: string;
  title?: string;
  wikibase_item?: string;
  description?: string;
  extract?: string;
  thumbnail?: { source: string; width?: number; height?: number };
  originalimage?: { source: string; width?: number; height?: number };
  content_urls?: { desktop?: { page?: string } };
};

/** Các từ bổ nghĩa thường gặp trong tên nguyên liệu tiếng Việt, dùng để rút gọn khi tra cứu thất bại */
const VI_MODIFIERS = [
  'tươi', 'khô', 'xay', 'băm', 'bằm', 'thái', 'lát', 'sợi', 'nhuyễn', 'bột',
  'đỏ', 'xanh', 'vàng', 'trắng', 'đen', 'tím', 'nâu',
  'lớn', 'nhỏ', 'to', 'non', 'già', 'chín', 'sống',
  'lạt', 'mặn', 'ngọt', 'cay', 'chua',
  'ta', 'tây', 'nhật', 'hàn', 'thái', 'tàu',
  'thăn', 'nạc', 'ba chỉ', 'bắp', 'đùi', 'sườn', 'cốt lết', 'vai', 'cổ', 'gân', 'mông', 'vụn',
  'phi lê', 'fillet', 'philê',
  'hạt', 'trái', 'quả', 'củ', 'lá', 'cây', 'tép', 'nhánh',
];

@Injectable()
export class IngredientEntityResolverService {
  private readonly logger = new Logger(IngredientEntityResolverService.name);
  private readonly userAgent = INGREDIENT_HTTP_USER_AGENT;

  /**
   * Phân giải thực thể nguyên liệu qua vi.wikipedia, Open Food Facts và Wikidata.
   * Xử lý trường hợp đa nghĩa (disambiguation) như "Đường" -> "Đường (thực phẩm)".
   */
  async resolve(
    name: string,
    nameEn?: string,
    synonyms: string[] = [],
  ): Promise<ResolvedIngredientEntity> {
    const entity: ResolvedIngredientEntity = {
      aliasesVi: [],
      p18Files: [],
      sources: [],
    };

    const cleanName = name.trim();
    if (!cleanName) return entity;

    // Bước 1: Tra cứu vi.wikipedia summary theo tên (và các biến thể rút gọn nếu cần)
    const titleCandidates = this.buildViTitleCandidates(cleanName, synonyms);
    let wikiSummary: WikiSummary | null = null;
    for (const candidate of titleCandidates) {
      const summary = await this.fetchWikipediaSummary(candidate, 'vi');
      if (summary && summary.type === 'standard') {
        wikiSummary = summary;
        break;
      }
      if (summary && summary.type === 'disambiguation' && !wikiSummary) {
        wikiSummary = summary; // giữ lại để xử lý ở bước tìm kiếm
      }
    }

    // Nếu là trang định hướng (disambiguation) hoặc không tìm thấy, thử tìm kiếm trang thực phẩm trên vi.wikipedia
    if (!wikiSummary || wikiSummary.type === 'disambiguation') {
      const searchHit = await this.searchWikipediaFoodArticle(cleanName);
      if (searchHit?.title) {
        const fullSummary = await this.fetchWikipediaSummary(searchHit.title, 'vi');
        if (fullSummary && fullSummary.type === 'standard') {
          wikiSummary = fullSummary;
        } else if (searchHit.wikibaseItem) {
          entity.wikidataId = searchHit.wikibaseItem;
          if (searchHit.title) entity.viTitle = searchHit.title;
          if (searchHit.extract) entity.extractVi = searchHit.extract;
          if (searchHit.description) entity.descriptionVi = searchHit.description;
          if (searchHit.thumbnail) entity.leadImage = searchHit.thumbnail;
        }
      }
    }

    if (wikiSummary && wikiSummary.type === 'standard') {
      this.applyViSummary(entity, wikiSummary);
    }

    // Bước 2: Thử tìm taxonomy trong Open Food Facts nếu có nameEn
    const offTagCandidate = nameEn
      ? `en:${nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
      : undefined;
    if (offTagCandidate) {
      await this.enrichFromOpenFoodFacts(offTagCandidate, entity);
    }

    // Bước 3: Nếu chưa có wikidataId, tìm kiếm trên Wikidata
    if (!entity.wikidataId) {
      const qid = await this.searchWikidataEntity(cleanName, nameEn, synonyms);
      if (qid) entity.wikidataId = qid;
    }

    // Bước 4: Lấy chi tiết từ Wikidata (P18, P373, aliases vi, sitelinks)
    if (entity.wikidataId) {
      await this.enrichFromWikidata(entity.wikidataId, entity);
    }

    // Bước 5: Fallback en.wikipedia nếu có nameEn mà vẫn chưa có ảnh/thực thể
    if (nameEn) {
      await this.enrichFromEnglish(nameEn, entity);
    }

    this.finalizeAliases(entity, cleanName);
    return entity;
  }

  /**
   * Bổ sung thông tin từ en.wikipedia + Wikidata theo tên tiếng Anh.
   * Gọi sau khi AI metadata sinh ra nameEn (khi resolve() lần đầu chưa có nameEn).
   */
  async enrichWithEnglishName(
    entity: ResolvedIngredientEntity,
    nameEn: string,
    originalName: string,
  ): Promise<ResolvedIngredientEntity> {
    const clean = nameEn.trim();
    if (!clean) return entity;
    await this.enrichFromEnglish(clean, entity);
    this.finalizeAliases(entity, originalName);
    return entity;
  }

  private async enrichFromEnglish(
    nameEn: string,
    entity: ResolvedIngredientEntity,
  ): Promise<void> {
    const needsImage = !entity.leadImage && !entity.p18Files.length;
    const needsEntity = !entity.wikidataId;
    if (!needsImage && !needsEntity && entity.enTitle) return;

    const summary = await this.fetchWikipediaSummary(nameEn, 'en');
    let enSummary: WikiSummary | null =
      summary && summary.type === 'standard' ? summary : null;

    if (!enSummary) {
      const hit = await this.searchWikipediaEn(nameEn);
      if (hit?.title) {
        const full = await this.fetchWikipediaSummary(hit.title, 'en');
        if (full && full.type === 'standard') enSummary = full;
      }
    }

    if (!enSummary) return;

    // Chỉ chấp nhận nếu Wikidata id khớp thực thể đã có, hoặc chưa có thực thể
    if (
      entity.wikidataId &&
      enSummary.wikibase_item &&
      enSummary.wikibase_item !== entity.wikidataId
    ) {
      // Thực thể khác: chỉ dùng ảnh nếu hiện tại chưa có ảnh nào
      if (needsImage && enSummary.originalimage?.source) {
        entity.leadImageEn = {
          source: enSummary.originalimage.source,
          width: enSummary.originalimage.width,
          height: enSummary.originalimage.height,
          title: enSummary.title,
        };
      }
      return;
    }

    if (!entity.enTitle && enSummary.title) entity.enTitle = enSummary.title;
    if (enSummary.thumbnail?.source || enSummary.originalimage?.source) {
      entity.leadImageEn = {
        source: enSummary.originalimage?.source || enSummary.thumbnail!.source,
        width: enSummary.originalimage?.width || enSummary.thumbnail?.width,
        height: enSummary.originalimage?.height || enSummary.thumbnail?.height,
        title: enSummary.title,
      };
    }
    if (enSummary.content_urls?.desktop?.page) {
      const exists = entity.sources.some((s) => s.name === 'Wikipedia (EN)');
      if (!exists) {
        entity.sources.push({
          name: 'Wikipedia (EN)',
          url: enSummary.content_urls.desktop.page,
        });
      }
    }

    if (!entity.wikidataId && enSummary.wikibase_item) {
      entity.wikidataId = enSummary.wikibase_item;
      await this.enrichFromWikidata(entity.wikidataId, entity);
    }
  }

  private applyViSummary(entity: ResolvedIngredientEntity, summary: WikiSummary) {
    entity.viTitle = summary.title;
    entity.wikidataId = summary.wikibase_item || entity.wikidataId;
    entity.descriptionVi = summary.description || entity.descriptionVi;
    entity.extractVi = summary.extract || entity.extractVi;
    if (summary.thumbnail?.source || summary.originalimage?.source) {
      entity.leadImage = {
        source: summary.originalimage?.source || summary.thumbnail!.source,
        width: summary.originalimage?.width || summary.thumbnail?.width,
        height: summary.originalimage?.height || summary.thumbnail?.height,
        title: summary.title,
      };
    }
    if (summary.content_urls?.desktop?.page) {
      const exists = entity.sources.some((s) => s.name === 'Wikipedia tiếng Việt');
      if (!exists) {
        entity.sources.push({
          name: 'Wikipedia tiếng Việt',
          url: summary.content_urls.desktop.page,
        });
      }
    }
  }

  private finalizeAliases(entity: ResolvedIngredientEntity, cleanName: string) {
    entity.aliasesVi = Array.from(
      new Set(
        entity.aliasesVi
          .map((a) => a.trim())
          .filter((a) => Boolean(a) && a.toLowerCase() !== cleanName.toLowerCase()),
      ),
    );
  }

  /**
   * Sinh danh sách tiêu đề vi.wikipedia để thử: tên gốc, synonyms, rồi tên rút gọn
   * (bỏ từ bổ nghĩa như "thăn", "lạt", "đỏ", "xay"...).
   */
  buildViTitleCandidates(name: string, synonyms: string[] = []): string[] {
    const out: string[] = [];
    const push = (v: string) => {
      const t = v.trim();
      if (t && !out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
    };
    push(name);
    for (const s of synonyms.slice(0, 3)) push(s);

    const words = name.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      // Bỏ dần các từ bổ nghĩa ở cuối / đầu
      let core = [...words];
      while (core.length >= 2) {
        const last = core[core.length - 1];
        const lastTwo = core.slice(-2).join(' ');
        if (VI_MODIFIERS.includes(lastTwo)) core = core.slice(0, -2);
        else if (VI_MODIFIERS.includes(last)) core = core.slice(0, -1);
        else break;
        if (core.length) push(core.join(' '));
      }
      // Bỏ từ bổ nghĩa ở giữa (vd: "thịt thăn bò" -> "thịt bò")
      const middleStripped = words.filter((w) => !VI_MODIFIERS.includes(w));
      if (middleStripped.length >= 1 && middleStripped.length < words.length) {
        push(middleStripped.join(' '));
      }
      // Cụm 2 từ đầu tiên (vd: "ớt chuông đỏ" -> "ớt chuông")
      if (words.length >= 3) push(words.slice(0, 2).join(' '));
    }
    return out.slice(0, 5);
  }

  private async fetchJson<T>(url: string, attempt = 0): Promise<T | null> {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': this.userAgent, accept: 'application/json' },
        signal: AbortSignal.timeout(8_000),
      });
      if (res.status === 429 && attempt < 2) {
        const retryAfter = Number(res.headers.get('retry-after')) || 0;
        const waitMs = Math.min(Math.max(retryAfter * 1000, 1_500 * (attempt + 1)), 6_000);
        await new Promise((r) => setTimeout(r, waitMs));
        return this.fetchJson<T>(url, attempt + 1);
      }
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch (err) {
      this.logger.debug(`fetchJson(${url.slice(0, 80)}) failed: ${(err as Error).message}`);
      return null;
    }
  }

  private async fetchWikipediaSummary(
    title: string,
    lang: 'vi' | 'en',
  ): Promise<WikiSummary | null> {
    const normalizedTitle = title.trim().replace(/\s+/g, '_');
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(normalizedTitle)}`;
    return this.fetchJson<WikiSummary>(url);
  }

  private async searchWikipediaEn(name: string): Promise<{ title?: string } | null> {
    const url = new URL('https://en.wikipedia.org/w/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('format', 'json');
    url.searchParams.set('list', 'search');
    url.searchParams.set('srsearch', `${name} food`);
    url.searchParams.set('srlimit', '3');
    const json = await this.fetchJson<{
      query?: { search?: Array<{ title: string }> };
    }>(url.toString());
    const hits = json?.query?.search ?? [];
    if (!hits.length) return null;
    const nameLower = name.toLowerCase();
    const matched =
      hits.find((h) => h.title.toLowerCase().includes(nameLower)) || hits[0];
    return { title: matched.title };
  }

  private async searchWikipediaFoodArticle(name: string): Promise<{
    title?: string;
    wikibaseItem?: string;
    description?: string;
    extract?: string;
    thumbnail?: { source: string; width?: number; height?: number };
  } | null> {
    const url = new URL('https://vi.wikipedia.org/w/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('format', 'json');
    url.searchParams.set('generator', 'search');
    url.searchParams.set('gsrsearch', `"${name}" thực phẩm OR gia vị OR nguyên liệu OR "thực vật"`);
    url.searchParams.set('gsrlimit', '5');
    url.searchParams.set('prop', 'pageimages|pageterms|extracts|pageprops');
    url.searchParams.set('piprop', 'thumbnail|original');
    url.searchParams.set('pithumbsize', '400');
    url.searchParams.set('exintro', '1');
    url.searchParams.set('explaintext', '1');
    url.searchParams.set('exsentences', '2');
    url.searchParams.set('pilicense', 'free');
    url.searchParams.set('wbptterms', 'description');

    const json = await this.fetchJson<{
      query?: {
        pages?: Record<
          string,
          {
            pageid: number;
            title: string;
            pageprops?: { wikibase_item?: string; disambiguation?: string };
            terms?: { description?: string[] };
            extract?: string;
            thumbnail?: { source: string; width?: number; height?: number };
            original?: { source: string; width?: number; height?: number };
          }
        >;
      };
    }>(url.toString());

    const pages = Object.values(json?.query?.pages ?? {}).filter(
      (p) => p.pageprops?.disambiguation === undefined,
    );
    if (!pages.length) return null;

    // Ưu tiên page có tên chứa name (ví dụ "Đường (thực phẩm)")
    const nameLower = name.toLowerCase();
    const matched =
      pages.find((p) => p.title.toLowerCase().includes(nameLower)) || pages[0];

    return {
      title: matched.title,
      wikibaseItem: matched.pageprops?.wikibase_item,
      description: matched.terms?.description?.[0],
      extract: matched.extract,
      thumbnail: matched.original || matched.thumbnail,
    };
  }

  private async enrichFromOpenFoodFacts(
    tag: string,
    entity: ResolvedIngredientEntity,
  ): Promise<void> {
    const url = `https://world.openfoodfacts.org/api/v2/taxonomy?tagtype=ingredients&tags=${encodeURIComponent(tag)}&fields=name,wikidata,parents&lc=vi,en`;
    const json = await this.fetchJson<
      Record<
        string,
        {
          name?: { vi?: string; en?: string };
          wikidata?: { en?: string; vi?: string };
          parents?: string[];
        }
      >
    >(url);
    const data = json?.[tag];
    if (!data) return;

    entity.offTag = tag;
    if (data.parents?.length) entity.offParents = data.parents;
    if (!entity.enTitle && data.name?.en) entity.enTitle = data.name.en;
    if (!entity.wikidataId) {
      entity.wikidataId = data.wikidata?.en || data.wikidata?.vi;
    }
    entity.sources.push({
      name: 'Open Food Facts',
      url: `https://world.openfoodfacts.org/ingredient/${tag.replace(/^en:/, '')}`,
    });
  }

  /** Chuẩn hóa nhẹ, giữ nguyên dấu tiếng Việt (chỉ hạ chữ, gộp khoảng trắng) */
  private softKey(value: string): string {
    return value.toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim();
  }

  private async searchWikidataEntity(
    name: string,
    nameEn?: string,
    synonyms: string[] = [],
  ): Promise<string | null> {
    const foodPattern =
      /thực phẩm|ẩm thực|gia vị|nguyên liệu|loài thực vật|loài cây|loài động vật|hạt|củ|trái cây|rau|thịt|nước mắm|đường|chemical compound|food|spice|plant|condiment|culinary|ingredient|vegetable|fruit|meat|seasoning|sauce|herb|cut of|edible/i;
    const nonFoodPattern =
      /album|band|film|phim|ban nhạc|bài hát|song|surname|họ|given name|tên|village|làng|xã|huyện|district|river|sông|company|công ty|tạp chí|magazine|number|số tự nhiên|year|năm|họ côn trùng|insect/i;

    const terms: Array<{ term: string; lang: 'vi' | 'en' }> = [];
    if (nameEn) terms.push({ term: nameEn, lang: 'en' });
    terms.push({ term: name, lang: 'vi' });
    for (const s of synonyms.slice(0, 2)) terms.push({ term: s, lang: 'vi' });

    for (const { term, lang } of terms) {
      const url = new URL('https://www.wikidata.org/w/api.php');
      url.searchParams.set('action', 'wbsearchentities');
      url.searchParams.set('search', term);
      url.searchParams.set('language', lang);
      url.searchParams.set('uselang', 'vi');
      url.searchParams.set('type', 'item');
      url.searchParams.set('limit', '8');
      url.searchParams.set('format', 'json');

      const json = await this.fetchJson<{
        search?: Array<{
          id: string;
          label?: string;
          description?: string;
          match?: { text?: string };
          aliases?: string[];
        }>;
      }>(url.toString());

      const hits = (json?.search ?? []).filter(
        (h) => !nonFoodPattern.test(h.description ?? ''),
      );
      if (!hits.length) continue;

      // So khớp GIỮ DẤU (không chấp nhận "xương bồ" cho "xương bò")
      const termKey = this.softKey(term);
      const labelExact = (h: (typeof hits)[number]) =>
        this.softKey(h.label ?? '') === termKey;
      const aliasExact = (h: (typeof hits)[number]) =>
        this.softKey(h.match?.text ?? '') === termKey;
      const isFood = (h: (typeof hits)[number]) =>
        foodPattern.test(`${h.label} ${h.description}`);

      // Ưu tiên: nhãn khớp + mô tả thực phẩm > nhãn khớp > alias khớp + mô tả thực phẩm
      const candidate =
        hits.find((h) => labelExact(h) && isFood(h)) ||
        hits.find((h) => labelExact(h)) ||
        hits.find((h) => aliasExact(h) && isFood(h));

      if (candidate?.id) return candidate.id;
    }
    return null;
  }

  private async enrichFromWikidata(
    wikidataId: string,
    entity: ResolvedIngredientEntity,
  ): Promise<void> {
    const url = new URL('https://www.wikidata.org/w/api.php');
    url.searchParams.set('action', 'wbgetentities');
    url.searchParams.set('ids', wikidataId);
    url.searchParams.set('props', 'labels|descriptions|aliases|claims|sitelinks');
    url.searchParams.set('languages', 'vi|en');
    url.searchParams.set('format', 'json');

    const json = await this.fetchJson<{
      entities?: Record<
        string,
        {
          labels?: { vi?: { value: string }; en?: { value: string } };
          descriptions?: { vi?: { value: string }; en?: { value: string } };
          aliases?: { vi?: Array<{ value: string }> };
          claims?: Record<
            string,
            Array<{ mainsnak?: { datavalue?: { value?: any } } }>
          >;
          sitelinks?: { viwiki?: { title: string }; enwiki?: { title: string } };
        }
      >;
    }>(url.toString());

    const item = json?.entities?.[wikidataId];
    if (!item) return;

    if (!entity.enTitle && item.labels?.en?.value) {
      entity.enTitle = item.labels.en.value;
    }
    if (!entity.descriptionVi && item.descriptions?.vi?.value) {
      entity.descriptionVi = item.descriptions.vi.value;
    }

    const viAliases = (item.aliases?.vi ?? []).map((a) => a.value).filter(Boolean);
    entity.aliasesVi.push(...viAliases);

    for (const claim of item.claims?.P18 ?? []) {
      const val = claim.mainsnak?.datavalue?.value;
      if (typeof val === 'string' && val.trim() && !entity.p18Files.includes(val.trim())) {
        entity.p18Files.push(val.trim());
      }
    }

    const catVal = item.claims?.P373?.[0]?.mainsnak?.datavalue?.value;
    if (typeof catVal === 'string' && catVal.trim() && !entity.commonsCategory) {
      entity.commonsCategory = catVal.trim();
    }

    if (!entity.sources.some((s) => s.name === 'Wikidata')) {
      entity.sources.push({
        name: 'Wikidata',
        url: `https://www.wikidata.org/wiki/${wikidataId}`,
      });
    }

    // Nếu chưa có leadImage/extract nhưng Wikidata có sitelink viwiki chuẩn -> gọi lại summary
    if ((!entity.leadImage || !entity.extractVi) && item.sitelinks?.viwiki?.title) {
      const summary = await this.fetchWikipediaSummary(item.sitelinks.viwiki.title, 'vi');
      if (summary && summary.type === 'standard') {
        const keepLead = entity.leadImage;
        this.applyViSummary(entity, summary);
        if (keepLead) entity.leadImage = keepLead;
      }
    }

    // Fallback en.wikipedia sitelink nếu vẫn chưa có ảnh nào
    if (
      !entity.leadImage &&
      !entity.leadImageEn &&
      !entity.p18Files.length &&
      item.sitelinks?.enwiki?.title
    ) {
      const summary = await this.fetchWikipediaSummary(item.sitelinks.enwiki.title, 'en');
      if (summary && summary.type === 'standard') {
        if (!entity.enTitle && summary.title) entity.enTitle = summary.title;
        if (summary.thumbnail?.source || summary.originalimage?.source) {
          entity.leadImageEn = {
            source: summary.originalimage?.source || summary.thumbnail!.source,
            width: summary.originalimage?.width || summary.thumbnail?.width,
            height: summary.originalimage?.height || summary.thumbnail?.height,
            title: summary.title,
          };
        }
      }
    }
  }
}
