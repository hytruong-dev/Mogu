import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  AiImportProvider,
  DishExtractionRequest,
} from './ai-provider';
import {
  DishExtractionV11,
  TargetedRepairRequest,
} from './ai-import.types';
import { DishExtractionV11Schema } from './dish-extraction.schema';

export interface AiDishResult {
  name: string;
  shortDescription: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  prepMinutes: number;
  cookMinutes: number;
  priceMin: number;
  priceMax: number;
  servings: number;
  servingSize: string;       // VD: "1 tô (400g)", "1 đĩa (300g)"
  ingredients: Array<{
    name: string;
    quantity: number;
    unit: string;
    preparation?: string;    // cách sơ chế: "thái lát", "băm nhỏ", "ngâm 30 phút"
    note?: string;           // ghi chú: "có thể thay bằng..."
    group?: string;          // nhóm: "Nguyên liệu chính", "Gia vị", "Rau ăn kèm"
  }>;
  steps: Array<{
    stepNumber: number;
    title: string;           // tiêu đề bước: "Sơ chế nguyên liệu"
    description: string;     // mô tả chi tiết
    durationMinutes: number; // thời gian thực hiện bước này (phút)
    tips?: string;           // mẹo hay cho bước này
  }>;
  tips?: string[];           // mẹo chung cho toàn bộ món
  tags?: string[];
}

export interface AiNutritionResult {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sodiumMg: number;
  servingName: string;
  servingG: number;
}

/**
 * Domain ẩm thực Việt uy tín — ưu tiên lấy ảnh món ăn từ đây.
 * Có thể override qua env AI_IMPORT_IMAGE_TRUSTED_DOMAINS (phân cách bằng dấu phẩy).
 */
const DEFAULT_TRUSTED_VN_FOOD_DOMAINS = [
  'vnexpress.net',        // VnExpress — chuyên mục Nấu ăn
  'dienmayxanh.com',      // Vào bếp — thư viện công thức lớn nhất VN
  'cooky.vn',             // Cộng đồng công thức Việt
  'monngonmoingay.com',   // Món ngon mỗi ngày
  'huongnghiepaau.com',   // Hướng Nghiệp Á Âu — công thức chuẩn
];

const envTrustedDomains = (process.env.AI_IMPORT_IMAGE_TRUSTED_DOMAINS ?? '')
  .split(',')
  .map((d) => d.trim())
  .filter(Boolean);

const TRUSTED_VN_FOOD_DOMAINS =
  envTrustedDomains.length > 0 ? envTrustedDomains : DEFAULT_TRUSTED_VN_FOOD_DOMAINS;

@Injectable()
export class AiService implements AiImportProvider {
  private readonly logger = new Logger(AiService.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('XKIRO_API_KEY') ?? '';
    this.client = new OpenAI({
      baseURL: this.config.get<string>('XKIRO_BASE_URL') ?? 'https://api.xkiro.com/v1',
      apiKey,
    });
    this.model = this.config.get<string>('XKIRO_MODEL') ?? 'deepseek/deepseek-chat-v3.1';
    this.logger.log(`AI model: ${this.model}`);
  }

  async extractDish(request: DishExtractionRequest): Promise<DishExtractionV11> {
    const prompt = `Bạn là hệ thống trích xuất món ăn Việt Nam. Chỉ trả về một JSON object hợp lệ theo schemaVersion 1.1, không Markdown và không giải thích.

Món: ${request.dishName}
Vùng gợi ý: ${request.regionName ?? 'không có'}
Từ khóa: ${(request.relatedKeywords ?? []).join(', ') || 'không có'}

Taxonomy candidate được phép dùng:
${JSON.stringify({
      regions: request.taxonomy.regions,
      provinces: request.taxonomy.provinces,
      categories: request.taxonomy.categories,
      mealTypes: request.taxonomy.mealTypes,
      goals: request.taxonomy.goals,
      dietTypes: request.taxonomy.dietTypes,
      flavors: request.taxonomy.flavors,
      dishTypes: request.taxonomy.dishTypes,
      units: request.taxonomy.units,
    })}

Contract bắt buộc:
{
  "schemaVersion":"1.1",
  "basic":{"name":"string","alternateNames":[],"shortDescription":"string","fullDescription":null,"difficulty":"EASY|MEDIUM|HARD","prepMinutes":0,"cookMinutes":0,"servings":1,"servingSize":null,"priceMin":null,"priceMax":null,"origin":{"originText":null,"regionCode":null,"provinceCode":null,"isRegionalSpecialty":false,"confidence":0,"reason":null}},
  "classification":{"categoryCodes":[],"mealTypeCodes":[],"goalCodes":[],"dietTypeCodes":[],"flavorCodes":[],"dishTypeCode":null,"confidenceByField":{}},
  "ingredients":[{"rawText":"string","name":"string","canonicalNameCandidate":null,"quantity":null,"quantityTo":null,"quantityText":null,"unitCode":null,"specification":null,"preparation":null,"group":null,"optional":false,"normalizedWeightGram":null}],
  "recipe":{"title":"string","servings":1,"prepMinutes":0,"cookMinutes":0,"difficulty":"EASY|MEDIUM|HARD","steps":[{"stepNumber":1,"title":"string","description":"string","durationMinutes":null,"tips":null}]},
  "generalTips":[]
}

Yêu cầu chất lượng dữ liệu:
- Mỗi nguyên liệu phải có quantity hoặc quantityText, unitCode phù hợp và preparation cụ thể nếu cần sơ chế; rawText phải chứa đầy đủ số lượng + đơn vị + tên + sơ chế.
- Giá phải là khoảng chi phí nguyên liệu thực tế cho toàn công thức tại Việt Nam, priceMin > 0 và priceMax >= priceMin.
- recipe.title phải là tên công thức tự nhiên, ví dụ "Cách làm cá bống kho tộ chuẩn vị".
- Công thức cần 4-8 bước chi tiết. Mỗi description phải nêu thao tác, thời gian hoặc dấu hiệu hoàn thành, nhiệt độ/lửa khi phù hợp; không viết mô tả sơ sài.
- flavorCodes dùng các mã ổn định phù hợp trong: THANH_NHE, DAM_DA, CAY, KHONG_CAY, CHUA, NGOT, BEO, MAN.
- Không phát minh taxonomy code ngoài candidate list, ngoại trừ flavorCodes theo danh sách ổn định vừa nêu.
- rawText phải giữ nguyên chuỗi nguyên liệu tự nhiên.`;
    const value = await this.completeJson(prompt, 4500);
    return DishExtractionV11Schema.parse(value);
  }

  async repairFields(request: TargetedRepairRequest): Promise<Record<string, unknown>> {
    const allowedPaths = request.invalidFields.map((field) => field.path);
    if (!allowedPaths.length) return {};
    const prompt = `Bạn sửa có mục tiêu dữ liệu món ăn. Chỉ trả JSON object, không Markdown.
Chỉ được trả các path lỗi sau, giữ đúng cấu trúc object lồng nhau: ${allowedPaths.join(', ')}.
Không trả hoặc thay đổi field khác.
Context: ${JSON.stringify(request.dishContext)}
Lỗi: ${JSON.stringify(request.invalidFields)}`;
    const value = await this.completeJson(prompt, 1200);
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('AI_IMPORT_REPAIR_INVALID_OBJECT');
    }
    return value as Record<string, unknown>;
  }

  private async completeJson(prompt: string, maxTokens: number): Promise<unknown> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });
    const content = response.choices[0]?.message?.content;
    if (!content?.trim()) throw new Error('AI_IMPORT_EMPTY_RESPONSE');
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`AI_IMPORT_INVALID_JSON: ${(error as Error).message}`);
    }
  }

  /** Bước 2: Gọi AI sinh công thức món ăn chi tiết */
  async generateDishData(
    dishName: string,
    regionName?: string,
    relatedKeywords?: string[],
  ): Promise<AiDishResult> {
    const keywordStr = relatedKeywords?.length
      ? `\nTừ khóa liên quan: ${relatedKeywords.join(', ')}`
      : '';
    const regionStr = regionName ? `\nVùng miền: ${regionName}` : '';

    const prompt = `Bạn là chuyên gia ẩm thực Việt Nam. Hãy tạo công thức CHI TIẾT, ĐẦY ĐỦ cho món ăn sau.
Tên món: ${dishName}${regionStr}${keywordStr}

YÊU CẦU:
- Nguyên liệu: liệt kê ĐẦY ĐỦ tất cả nguyên liệu thực tế (bao gồm gia vị nhỏ như muối, đường, nước mắm), ghi rõ cách sơ chế từng nguyên liệu, phân nhóm (Nguyên liệu chính / Gia vị / Rau ăn kèm)
- Cách làm: chia thành các BƯỚC RÕ RÀNG (thường 4-6 bước), mỗi bước có tiêu đề ngắn gọn, mô tả chi tiết các thao tác cụ thể, thời gian thực hiện bước đó (phút), kèm mẹo nhỏ nếu có
- Mô tả ngắn: 1-2 câu nêu đặc điểm nổi bật của món

Trả về JSON thuần (KHÔNG có markdown, KHÔNG có text trước/sau JSON):
{
  "name": "tên món đầy đủ",
  "shortDescription": "mô tả 1-2 câu đặc điểm nổi bật",
  "difficulty": "EASY hoặc MEDIUM hoặc HARD",
  "prepMinutes": số phút chuẩn bị/sơ chế,
  "cookMinutes": số phút nấu/chế biến,
  "priceMin": giá thấp nhất VND (thực tế tại Việt Nam),
  "priceMax": giá cao nhất VND,
  "servings": số khẩu phần (người),
  "servingSize": "mô tả 1 khẩu phần VD: 1 tô 400g hoặc 1 đĩa 300g",
  "ingredients": [
    {
      "name": "tên nguyên liệu cụ thể",
      "quantity": số lượng (số thực),
      "unit": "đơn vị (g/ml/quả/củ/muỗng canh/muỗng cà phê/lá/nhánh...)",
      "preparation": "cách sơ chế: thái lát/băm nhỏ/ngâm 30 phút/... (để trống nếu dùng trực tiếp)",
      "group": "Nguyên liệu chính hoặc Gia vị hoặc Rau ăn kèm"
    }
  ],
  "steps": [
    {
      "stepNumber": 1,
      "title": "Tiêu đề bước ngắn gọn (VD: Sơ chế nguyên liệu)",
      "description": "Mô tả chi tiết từng thao tác trong bước này, càng cụ thể càng tốt. Ghi rõ nhiệt độ, thời gian, dấu hiệu nhận biết khi thành công.",
      "durationMinutes": thời gian thực hiện bước này (phút, số nguyên),
      "tips": "mẹo hay cho bước này (để trống nếu không có)"
    }
  ],
  "tips": ["mẹo chung 1 cho toàn bộ món", "mẹo chung 2"],
  "tags": ["tag1", "tag2"]
}`;

    this.logger.debug(`Calling AI for dish: ${dishName}`);

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3000,
      temperature: 0.2,
    });

    const content = response.choices[0]?.message?.content ?? '';
    return this.parseJson<AiDishResult>(content, this.defaultDishResult(dishName));
  }
  /** Bước 5: Gọi AI tính dinh dưỡng từ danh sách nguyên liệu */
  async estimateNutrition(
    dishName: string,
    ingredients: Array<{ name: string; quantity: number; unit: string }>,
  ): Promise<AiNutritionResult> {
    const ingredientList = ingredients
      .map((i) => `- ${i.quantity} ${i.unit} ${i.name}`)
      .join('\n');

    const prompt = `Ước tính dinh dưỡng cho 1 khẩu phần của món "${dishName}" với nguyên liệu sau:
${ingredientList}

Trả về JSON thuần (không có markdown):
{
  "calories": kcal,
  "proteinG": gram đạm,
  "carbsG": gram tinh bột,
  "fatG": gram chất béo,
  "fiberG": gram chất xơ,
  "sodiumMg": mg natri,
  "servingName": "tên khẩu phần VD: 1 tô (500g)",
  "servingG": gram khẩu phần
}`;

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.2,
    });

    const content = response.choices[0]?.message?.content ?? '';
    return this.parseJson<AiNutritionResult>(content, this.defaultNutrition());
  }

  /**
   * Tìm ảnh đại diện cho món ăn qua Pexels API.
   * Trả về URL ảnh hoặc null nếu không tìm được.
   */
  /**
   * Tìm ảnh đại diện cho món ăn.
   * Ưu tiên: Wikipedia VI/EN (EXACT title — tránh nhận bài sai topic)
   *        → Tavily image search (giống Google Images, query tiếng Việt)
   *        → Unsplash (chỉ nhận khi mô tả khớp ≥ 1 từ khóa)
   *        → null (để admin tự chọn, còn hơn ảnh sai)
   */
  async searchDishImage(dishName: string): Promise<string | null> {
    // Chuẩn bị English query (chuẩn hơn cho Unsplash)
    const enQuery = this.toEnglishQuery(dishName);

    // 1️⃣ Tavily giới hạn domain ẩm thực Việt uy tín (VnExpress, Điện máy Xanh...)
    //    — ảnh từ bài công thức thật nên chuẩn nhất cho món Việt
    const trustedImg = await this.searchTavilyImage(dishName, TRUSTED_VN_FOOD_DOMAINS);
    if (trustedImg) {
      this.logger.debug(`Using trusted VN food site image for "${dishName}"`);
      return trustedImg;
    }

    // 2️⃣ Wikipedia VI — CHỈ nhận khi title khớp tên món (tránh vụ "Xôi mặn" → bài cá sấu)
    const viImg = await this.searchWikipediaImageExact(dishName, 'vi');
    if (viImg) {
      this.logger.debug(`Using Wikipedia VI image for "${dishName}"`);
      return viImg;
    }

    // 3️⃣ Wikipedia EN — exact title với tên đã romanize/map
    const enImg = await this.searchWikipediaImageExact(enQuery, 'en');
    if (enImg) {
      this.logger.debug(`Using Wikipedia EN image for "${dishName}"`);
      return enImg;
    }

    // 4️⃣ Tavily toàn web — cho món không có trên các trang trusted
    const tavilyImg = await this.searchTavilyImage(dishName);
    if (tavilyImg) {
      this.logger.debug(`Using Tavily image for "${dishName}"`);
      return tavilyImg;
    }

    // 5️⃣ Unsplash — fallback cuối, tìm bằng English query cụ thể
    const unsplashKey = this.config.get<string>('UNSPLASH_ACCESS_KEY');
    if (unsplashKey) {
      try {
        // Tìm 5 kết quả, chọn cái có alt_description khớp tên món nhất
        const q = encodeURIComponent(enQuery);
        const res = await fetch(
          `https://api.unsplash.com/search/photos?query=${q}&per_page=5&orientation=landscape`,
          { headers: { Authorization: `Client-ID ${unsplashKey}`, 'Accept-Version': 'v1' } },
        );
        if (res.ok) {
          const data = await res.json() as {
            results?: Array<{
              urls?: { regular?: string };
              alt_description?: string;
              description?: string;
            }>;
          };
          const results = data.results ?? [];
          // Score theo keyword của cả tên VI lẫn English query
          const keywords = [
            ...dishName.toLowerCase().split(' '),
            ...enQuery.toLowerCase().split(' '),
          ].filter(k => k.length > 2);
          const scored = results.map(r => {
            const desc = ((r.alt_description ?? '') + ' ' + (r.description ?? '')).toLowerCase();
            const score = keywords.filter(k => desc.includes(k)).length;
            return { img: r.urls?.regular, score };
          }).filter(r => r.img);

          // CHỈ nhận ảnh có score ≥ 1 — score 0 nghĩa là ảnh không liên quan
          scored.sort((a, b) => b.score - a.score);
          const best = scored.find(r => r.score >= 1);
          if (best?.img) {
            this.logger.debug(`Unsplash fallback: found for "${dishName}" (score: ${best.score})`);
            return best.img;
          }
          this.logger.debug(`Unsplash: no relevant match for "${dishName}" — skipping`);
        }
      } catch (e) {
        this.logger.warn(`Unsplash failed: ${(e as Error).message}`);
      }
    }

    // Không tìm được ảnh đáng tin — trả null để admin tự chọn (tốt hơn ảnh sai)
    this.logger.warn(`No trusted image found for "${dishName}"`);
    return null;
  }

  /**
   * Tavily image search — trả ảnh từ kết quả web thật (bài viết công thức,
   * báo ẩm thực...) nên độ khớp cao với món Việt, kể cả món không có Wikipedia.
   * @param includeDomains giới hạn tìm trong các domain uy tín (VD: VnExpress)
   */
  private async searchTavilyImage(
    dishName: string,
    includeDomains?: string[],
  ): Promise<string | null> {
    const tavilyKey = this.config.get<string>('TAVILY_API_KEY');
    if (!tavilyKey) return null;
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tavilyKey}`,
        },
        body: JSON.stringify({
          query: includeDomains
            ? `cách làm món ${dishName}`
            : `món ${dishName} Việt Nam`,
          search_depth: 'basic',
          include_images: true,
          include_image_descriptions: true,
          max_results: 3,
          ...(includeDomains ? { include_domains: includeDomains } : {}),
        }),
      });
      if (!res.ok) {
        this.logger.warn(`Tavily image search HTTP ${res.status}`);
        return null;
      }
      const data = await res.json() as {
        images?: Array<string | { url?: string; description?: string }>;
      };
      const images = (data.images ?? []).map((img) =>
        typeof img === 'string'
          ? { url: img, description: '' }
          : { url: img.url ?? '', description: (img.description ?? '').toLowerCase() },
      ).filter(i => i.url);
      if (images.length === 0) return null;

      // Score theo description (nếu có) — ưu tiên ảnh mô tả khớp tên món
      const keywords = this.normalizeViet(dishName).split(' ').filter(k => k.length > 1);
      const scored = images
        .map(i => {
          const desc = this.normalizeViet(i.description);
          const score = keywords.filter(k => desc.includes(k)).length;
          return { ...i, score };
        })
        .sort((a, b) => b.score - a.score);

      // Có description → yêu cầu khớp ≥ 1 từ; không có description → tin kết quả đầu
      const hasDescriptions = images.some(i => i.description);
      const best = hasDescriptions ? scored.find(i => i.score >= 1) : scored[0];
      return best?.url ?? null;
    } catch (e) {
      this.logger.warn(`Tavily image search failed: ${(e as Error).message}`);
      return null;
    }
  }

  /** Bỏ dấu tiếng Việt + lowercase để so khớp từ khóa ổn định */
  private normalizeViet(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd');
  }

  /** Map tên món Việt → Wikipedia article title + Unsplash query chính xác */
  /**
   * @deprecated Prefer IngredientImageEnrichmentService / Wikimedia+Openverse queue.
   * Kept only for legacy callers; do not write returned URLs as approved Ingredient.imageUrl.
   */
  async searchIngredientImage(ingredientName: string): Promise<string | null> {
    const enQuery = this.toEnglishIngredientQuery(ingredientName);
    const unsplashKey = this.config.get<string>('UNSPLASH_ACCESS_KEY');

    // 1️⃣ Unsplash — ưu tiên cao nhất vì có thể score theo từ khóa food
    if (unsplashKey) {
      try {
        const q = encodeURIComponent(`${enQuery} food`);
        const res = await fetch(
          `https://api.unsplash.com/search/photos?query=${q}&per_page=5&orientation=squarish`,
          { headers: { Authorization: `Client-ID ${unsplashKey}`, 'Accept-Version': 'v1' } },
        );
        if (res.ok) {
          const data = await res.json() as {
            results?: Array<{ urls?: { regular?: string }; alt_description?: string; description?: string }>;
          };
          const results = data.results ?? [];
          // Score: ưu tiên ảnh có alt_description chứa từ khóa chính
          const keywords = enQuery.toLowerCase().split(' ').filter(k => k.length > 2);
          const scored = results
            .map(r => {
              const desc = ((r.alt_description ?? '') + ' ' + (r.description ?? '')).toLowerCase();
              const score = keywords.filter(k => desc.includes(k)).length;
              return { img: r.urls?.regular, score };
            })
            .filter(r => r.img);
          scored.sort((a, b) => b.score - a.score);
          const best = scored[0]?.img;
          if (best) {
            this.logger.debug(`Ingredient Unsplash: "${ingredientName}" → score ${scored[0]?.score}`);
            return best;
          }
        }
      } catch (e) {
        this.logger.warn(`Ingredient Unsplash failed: ${(e as Error).message}`);
      }
    }

    // 2️⃣ Wikipedia VI — chỉ dùng nếu title tìm được KHỚP CHÍNH XÁC với tên nguyên liệu
    const viImg = await this.searchWikipediaImageExact(ingredientName, 'vi');
    if (viImg) return viImg;

    // 3️⃣ Wikipedia EN — exact match với English query
    const enImg = await this.searchWikipediaImageExact(enQuery, 'en');
    if (enImg) return enImg;

    return null;
  }

  /**
   * Wikipedia search với EXACT title check — tránh nhận bài sai topic.
   * Điều kiện khớp (sau khi bỏ dấu + lowercase):
   *   - Từ ĐẦU TIÊN của query (loại món: xôi/bún/cơm/phở...) phải có trong title
   *   - VÀ ≥ 50% số từ của query xuất hiện trong title
   * Ví dụ: "Xôi mặn" sẽ KHÔNG khớp "Cá sấu nước mặn" (thiếu "xôi").
   */
  private async searchWikipediaImageExact(query: string, lang: 'vi' | 'en'): Promise<string | null> {
    try {
      const q = encodeURIComponent(query);
      const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&srlimit=3&format=json&origin=*`;
      const searchRes = await fetch(searchUrl);
      if (!searchRes.ok) return null;
      const searchData = await searchRes.json() as {
        query?: { search?: Array<{ title: string }> };
      };
      const results = searchData.query?.search ?? [];
      if (results.length === 0) return null;

      // Verify: từ đầu tiên phải khớp + đa số từ khớp (so sánh không dấu)
      const queryWords = this.normalizeViet(query).split(' ').filter(w => w.length > 1);
      if (queryWords.length === 0) return null;
      const matchedTitle = results.find(r => {
        const titleNorm = this.normalizeViet(r.title);
        if (!titleNorm.includes(queryWords[0])) return false;
        const hits = queryWords.filter(w => titleNorm.includes(w)).length;
        return hits / queryWords.length >= 0.5;
      });
      if (!matchedTitle) {
        this.logger.debug(`Wikipedia (${lang}): no exact title match for "${query}" (got: ${results[0]?.title})`);
        return null;
      }

      // Lấy thumbnail
      const imgUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(matchedTitle.title)}&prop=pageimages&format=json&pithumbsize=800&origin=*`;
      const imgRes = await fetch(imgUrl);
      if (!imgRes.ok) return null;
      const imgData = await imgRes.json() as {
        query?: { pages?: Record<string, { thumbnail?: { source?: string } }> };
      };
      const thumb = Object.values(imgData.query?.pages ?? {})[0]?.thumbnail?.source;
      if (thumb) {
        this.logger.debug(`Wikipedia (${lang}): exact match "${matchedTitle.title}" for "${query}"`);
        return thumb;
      }
    } catch (e) {
      this.logger.warn(`Wikipedia exact (${lang}) failed: ${(e as Error).message}`);
    }
    return null;
  }

  /** Map tên nguyên liệu Việt → English query chuẩn xác cho Unsplash/Wikipedia */
  private toEnglishIngredientQuery(name: string): string {
    // Map đầy đủ: key là tên VI (hoặc một phần), value là English food query chuẩn
    const map: Array<[string, string]> = [
      // ── Thịt / Gia cầm ──────────────────────────────────────────────────
      ['gà ta', 'free-range chicken whole raw'],
      ['gà mái', 'hen chicken whole'],
      ['gà', 'raw chicken meat'],
      ['thịt gà', 'raw chicken meat pieces'],
      ['thịt heo ba chỉ', 'pork belly sliced raw'],
      ['thịt heo', 'raw pork meat'],
      ['thịt bò', 'raw beef meat'],
      ['thịt vịt', 'duck meat raw'],
      ['giò heo', 'pork hock knuckle'],
      ['xương bò', 'beef bones raw'],
      ['xương heo', 'pork bones raw'],
      ['xúc xích', 'sausage fresh'],
      // ── Hải sản ─────────────────────────────────────────────────────────
      ['tôm sú', 'tiger prawn raw'],
      ['tôm', 'fresh shrimp prawn'],
      ['cá', 'fresh fish whole'],
      ['cá hồi', 'salmon fish fresh'],
      ['cá ngừ', 'tuna fish fresh'],
      ['mực', 'squid fresh'],
      ['cua', 'crab fresh'],
      // ── Gạo / Tinh bột / Sợi ────────────────────────────────────────────
      ['gạo tẻ', 'white jasmine rice raw grain'],
      ['gạo nếp', 'glutinous sticky rice grain'],
      ['gạo thơm lài', 'jasmine rice grain'],
      ['gạo thơm', 'jasmine rice grain'],
      ['gạo lài', 'jasmine rice grain'],
      ['gạo', 'white rice grain raw'],
      ['bột gạo', 'rice flour white powder'],
      ['bột mì', 'wheat flour white powder'],
      ['bún tươi', 'Vietnamese rice vermicelli fresh'],
      ['bún', 'rice vermicelli noodle'],
      ['bánh phở tươi', 'pho fresh rice noodle'],
      ['bánh canh tươi', 'thick rice noodle Vietnamese'],
      ['miến', 'glass noodle cellophane'],
      ['mì trắng', 'egg noodle raw white'],
      ['cơm nguội', 'cooked white rice leftover'],
      // ── Rau củ quả ──────────────────────────────────────────────────────
      ['hành tây', 'brown onion whole vegetable'],
      ['hành lá', 'green onion spring onion scallion fresh'],
      ['nành hành lá', 'green onion spring onion fresh'],
      ['hành tím', 'shallot purple small onion'],
      ['tỏi', 'garlic bulb cloves fresh'],
      ['gừng', 'ginger root fresh'],
      ['sả', 'lemongrass stalk fresh'],
      ['nghệ tươi', 'fresh turmeric root yellow'],
      ['nghệ', 'turmeric root fresh'],
      ['ớt sừng', 'red horn chili pepper fresh'],
      ['ớt', 'fresh chili pepper red'],
      ['cà chua', 'red tomato fresh'],
      ['cà rốt', 'carrot fresh vegetable'],
      ['cà tím', 'eggplant aubergine fresh'],
      ['khoai tây', 'potato fresh vegetable'],
      ['bắp cải', 'green cabbage fresh'],
      ['cải thảo', 'napa cabbage Chinese'],
      ['rau muống chẻ', 'water spinach Vietnamese fresh'],
      ['rau muống', 'water spinach Vietnamese'],
      ['rau cải', 'bok choy vegetable'],
      ['cải thìa', 'bok choy baby'],
      ['rau bina', 'spinach fresh leaves'],
      ['dưa leo', 'cucumber fresh vegetable'],
      ['quả dưa leo', 'cucumber fresh vegetable'],
      ['bắp chuối', 'banana blossom flower'],
      ['bắp', 'corn maize fresh'],
      ['đậu Hà Lan', 'snow peas green vegetable'],
      ['đậu xanh không vỏ', 'mung bean split yellow'],
      ['đậu xanh', 'mung bean green'],
      ['đậu phụ', 'tofu block white'],
      ['đậu hũ', 'tofu silken white'],
      ['đậu nành', 'soybean'],
      ['đậu đỏ', 'red kidney bean'],
      ['rau răm', 'Vietnamese coriander herb fresh'],
      ['rau mùi', 'cilantro coriander herb fresh'],
      ['hạt mùi', 'coriander seeds spice'],
      ['rau sống các loại', 'Vietnamese fresh herbs salad'],
      ['rau sống', 'fresh herbs lettuce Vietnamese'],
      ['nấm hương', 'shiitake mushroom dried'],
      ['nấm rơm', 'straw mushroom Asian'],
      ['nấm', 'mushroom fresh'],
      ['bí đỏ', 'pumpkin orange fresh'],
      ['bí xanh', 'winter melon whole'],
      ['khổ qua', 'bitter melon gourd'],
      // ── Gia vị / Nước chấm ──────────────────────────────────────────────
      ['muối', 'salt white coarse'],
      ['đường', 'sugar white granulated'],
      ['nước mắm ngon', 'Vietnamese fish sauce bottle'],
      ['nước mắm', 'Vietnamese fish sauce bottle'],
      ['nước tương', 'soy sauce dark bottle'],
      ['xì dầu', 'soy sauce bottle'],
      ['dầu hào', 'oyster sauce bottle'],
      ['dầu mè', 'sesame oil dark bottle'],
      ['dầu điều', 'annatto oil red cooking'],
      ['dầu phộng', 'peanut oil cooking'],
      ['dầu ăn', 'cooking oil vegetable bottle'],
      ['giấm', 'white vinegar bottle'],
      ['tương hoisin', 'hoisin sauce bottle'],
      ['mắm ruốc Huế', 'shrimp paste Vietnamese'],
      ['tiêu xay', 'ground black pepper spice'],
      ['tiêu đen', 'black pepper whole grain'],
      ['hoa hồi', 'star anise spice'],
      ['thảo quả', 'cardamom black Asian'],
      // ── Trứng / Sữa ─────────────────────────────────────────────────────
      ['trứng gà', 'chicken egg raw fresh'],
      ['trứng vịt', 'duck egg raw'],
      ['trứng', 'egg raw fresh'],
      // ── Nước / Chất lỏng ────────────────────────────────────────────────
      ['nước luộc gà', 'chicken broth stock clear soup'],
      ['nước cốt dừa', 'coconut milk creamy white'],
      ['nước lọc', 'clean water glass'],
    ];

    const lower = name.toLowerCase().trim();
    // Tìm match dài nhất → cụ thể nhất
    const sorted = [...map].sort((a, b) => b[0].length - a[0].length);
    for (const [vi, en] of sorted) {
      if (lower === vi || lower.includes(vi)) return en;
    }
    // Fallback: bỏ dấu + thêm context "food ingredient"
    const romanized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').trim();
    return `${romanized} food ingredient cooking`;
  }
  private toEnglishQuery(name: string): string {
    const map: Array<{ keys: string[]; wiki: string }> = [
      // Phở
      { keys: ['phở bò'], wiki: 'Pho bo Vietnamese beef noodle soup' },
      { keys: ['phở gà'], wiki: 'Pho ga Vietnamese chicken noodle soup' },
      { keys: ['phở'], wiki: 'Pho Vietnamese noodle soup' },
      // Bánh mì
      { keys: ['bánh mì hà nội', 'bánh mì hà-nội'], wiki: 'Banh mi Hanoi Vietnamese baguette sandwich' },
      { keys: ['bánh mì sài gòn', 'bánh mì saigon'], wiki: 'Banh mi Saigon Vietnamese sandwich' },
      { keys: ['bánh mì'], wiki: 'Banh mi Vietnamese sandwich bread' },
      // Bún
      { keys: ['bún bò huế', 'bún bò hue'], wiki: 'Bun bo Hue spicy beef noodle soup' },
      { keys: ['bún bò'], wiki: 'Bun bo Vietnamese beef noodle' },
      { keys: ['bún chả'], wiki: 'Bun cha Hanoi grilled pork rice vermicelli' },
      { keys: ['bún riêu'], wiki: 'Bun rieu Vietnamese crab tomato noodle soup' },
      { keys: ['bún thịt nướng'], wiki: 'Bun thit nuong Vietnamese grilled pork vermicelli' },
      // Cơm
      { keys: ['cơm tấm'], wiki: 'Com tam Vietnamese broken rice pork' },
      { keys: ['cơm chiên', 'cơm rang'], wiki: 'Vietnamese fried rice dish' },
      // Bánh
      { keys: ['bánh xèo'], wiki: 'Banh xeo Vietnamese sizzling crepe pancake' },
      { keys: ['bánh cuốn'], wiki: 'Banh cuon Vietnamese steamed rice roll' },
      { keys: ['bánh canh'], wiki: 'Banh canh Vietnamese thick noodle soup' },
      { keys: ['bánh ướt'], wiki: 'Banh uot Vietnamese steamed rice sheet' },
      // Gỏi / cuốn
      { keys: ['gỏi cuốn'], wiki: 'Goi cuon Vietnamese fresh spring rolls' },
      { keys: ['chả giò', 'nem rán'], wiki: 'Cha gio Vietnamese fried spring rolls' },
      { keys: ['gỏi ngó sen'], wiki: 'Vietnamese lotus stem salad' },
      // Thịt / kho
      { keys: ['bò kho'], wiki: 'Bo kho Vietnamese beef stew' },
      { keys: ['thịt kho'], wiki: 'Thit kho Vietnamese caramelized pork belly' },
      { keys: ['cá kho'], wiki: 'Ca kho Vietnamese caramelized fish' },
      // Canh / lẩu
      { keys: ['lẩu thái'], wiki: 'Thai hot pot Vietnamese style' },
      { keys: ['lẩu'], wiki: 'Vietnamese hot pot lau' },
      { keys: ['canh chua'], wiki: 'Canh chua Vietnamese sour soup' },
      // Mì / hủ tiếu
      { keys: ['mì quảng'], wiki: 'Mi Quang Vietnamese turmeric noodle' },
      { keys: ['hủ tiếu'], wiki: 'Hu tieu Vietnamese noodle soup pork' },
      { keys: ['cao lầu'], wiki: 'Cao lau Hoi An noodle dish' },
      // Chè / xôi
      { keys: ['chè'], wiki: 'Vietnamese sweet dessert soup che' },
      { keys: ['xôi'], wiki: 'Xoi Vietnamese sticky rice' },
      // Đặc sản vùng miền
      { keys: ['cháo lòng'], wiki: 'Vietnamese pork organ congee' },
      { keys: ['cháo'], wiki: 'Vietnamese rice congee chao' },
      { keys: ['bít tết'], wiki: 'Vietnamese steak beefsteak' },
    ];

    const lower = name.toLowerCase().trim();

    // Tìm khớp theo độ dài key (dài hơn = cụ thể hơn) → sort desc
    const sorted = [...map].sort((a, b) =>
      Math.max(...b.keys.map(k => k.length)) - Math.max(...a.keys.map(k => k.length))
    );

    for (const entry of sorted) {
      if (entry.keys.some(k => lower.includes(k))) {
        return entry.wiki;
      }
    }

    // Fallback: bỏ dấu + thêm context
    const romanized = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/gi, 'd')
      .trim();
    return `${romanized} Vietnamese food dish`;
  }

  private parseJson<T>(raw: string, fallback: T): T {
    try {
      // Xử lý trường hợp model trả về markdown code block
      const cleaned = raw
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      // Tìm JSON object đầu tiên
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('No JSON found');
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    } catch (e) {
      this.logger.warn(`AI JSON parse failed: ${(e as Error).message}. Using fallback.`);
      return fallback;
    }
  }

  private defaultDishResult(name: string): AiDishResult {
    return {
      name,
      shortDescription: 'Món ăn truyền thống Việt Nam.',
      difficulty: 'MEDIUM',
      prepMinutes: 30,
      cookMinutes: 30,
      priceMin: 30000,
      priceMax: 60000,
      servings: 2,
      servingSize: '1 phần',
      ingredients: [],
      steps: [],
      tips: [],
      tags: [],
    };
  }

  private defaultNutrition(): AiNutritionResult {
    return {
      calories: 400,
      proteinG: 20,
      carbsG: 50,
      fatG: 10,
      fiberG: 3,
      sodiumMg: 800,
      servingName: '1 khẩu phần',
      servingG: 300,
    };
  }
}
