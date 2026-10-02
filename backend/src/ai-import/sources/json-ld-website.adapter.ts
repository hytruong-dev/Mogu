import { Injectable } from '@nestjs/common';
import { RecipeEvidence } from '../ai-import.types';
import {
  DishSourceAdapter,
  SourceExtraction,
  SourceExtractionRequest,
  SourceFieldClaim,
  SourceReference,
} from './source-adapter';

type JsonObject = Record<string, unknown>;

export interface JsonLdRecipeStep {
  stepNumber: number;
  title: string;
  description: string;
  imageUrls: string[];
}

export interface JsonLdRecipeVideo {
  name?: string | null;
  description?: string | null;
  embedUrl?: string | null;
  contentUrl?: string | null;
  thumbnailUrl?: string | null;
  duration?: number | null;
  /** URL chuẩn hóa (youtube watch) nếu nhận ra. */
  watchUrl?: string | null;
}

const HTML_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  acirc: 'â', Acirc: 'Â', ecirc: 'ê', Ecirc: 'Ê', ocirc: 'ô', Ocirc: 'Ô',
  agrave: 'à', Agrave: 'À', aacute: 'á', Aacute: 'Á', atilde: 'ã', Atilde: 'Ã',
  egrave: 'è', Egrave: 'È', eacute: 'é', Eacute: 'É',
  igrave: 'ì', Igrave: 'Ì', iacute: 'í', Iacute: 'Í',
  ograve: 'ò', Ograve: 'Ò', oacute: 'ó', Oacute: 'Ó', otilde: 'õ', Otilde: 'Õ',
  ugrave: 'ù', Ugrave: 'Ù', uacute: 'ú', Uacute: 'Ú',
  yacute: 'ý', Yacute: 'Ý', ETH: 'Đ', eth: 'đ',
  hellip: '…', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
};

/** Giải mã HTML entities (named + numeric) — các trang VN hay encode tiếng Việt kiểu `&acirc;`. */
export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeFromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (match, name) => HTML_ENTITIES[name] ?? match);
}

function safeFromCodePoint(code: number): string {
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

/** youtube.com/embed/{id}, youtu.be/{id}, youtube.com/watch?v={id} -> https://www.youtube.com/watch?v={id} */
export function normalizeYoutubeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\.|^m\./, '');
    let id: string | null = null;
    if (host === 'youtu.be') id = parsed.pathname.split('/').filter(Boolean)[0] ?? null;
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (parsed.pathname === '/watch') id = parsed.searchParams.get('v');
      else {
        const match = parsed.pathname.match(/^\/(?:embed|v|shorts|live)\/([A-Za-z0-9_-]{6,})/);
        id = match?.[1] ?? null;
      }
    }
    if (!id || !/^[A-Za-z0-9_-]{6,}$/.test(id)) return null;
    return `https://www.youtube.com/watch?v=${id}`;
  } catch {
    return null;
  }
}

@Injectable()
export class JsonLdWebsiteAdapter implements DishSourceAdapter {
  readonly kind = 'WEBSITE' as const;

  supports(input: SourceExtractionRequest): boolean {
    const type = input.contentType?.toLowerCase();
    return (
      (!type || type.includes('html')) &&
      /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>/i.test(
        input.body,
      )
    );
  }

  async extract(input: SourceExtractionRequest): Promise<SourceExtraction> {
    const source: SourceReference = {
      kind: this.kind,
      uri: input.uri,
      retrievedAt: input.retrievedAt ?? new Date().toISOString(),
    };
    const warnings: string[] = [];
    const recipes = this.readRecipes(input.body, warnings);
    const claims = recipes.flatMap((recipe, index) =>
      this.toClaims(recipe, source, index),
    );

    return { source, claims, warnings };
  }

  /**
   * Gom claims của Recipe đầu tiên thành RecipeEvidence để truyền cho AI extractDish.
   * Trả null nếu không có công thức.
   */
  toRecipeEvidence(extraction: SourceExtraction): RecipeEvidence | null {
    const first = (fieldPath: string) =>
      extraction.claims.find((claim) => claim.fieldPath === fieldPath && claim.selector?.endsWith('[0]'))?.value;
    const ingredients = (first('ingredients') as Array<{ rawText: string }> | undefined) ?? [];
    const steps = (first('recipe.steps') as JsonLdRecipeStep[] | undefined) ?? [];
    if (!ingredients.length && !steps.length) return null;
    const video = first('recipe.video') as JsonLdRecipeVideo | undefined;
    const nutritionKeys = ['caloriesKcal', 'proteinG', 'carbsG', 'fatG', 'fiberG', 'sodiumMg'];
    const nutrition: Record<string, number | null> = {};
    let hasNutrition = false;
    for (const key of nutritionKeys) {
      const value = first(`nutrition.${key}`);
      if (typeof value === 'number') {
        nutrition[key === 'caloriesKcal' ? 'calories' : key] = value;
        hasNutrition = true;
      }
    }
    let sourceDomain: string | null = null;
    try {
      sourceDomain = new URL(extraction.source.uri).hostname.replace(/^www\./, '');
    } catch {
      sourceDomain = null;
    }
    return {
      sourceUrl: extraction.source.uri,
      sourceDomain,
      title: (first('basic.name') as string | undefined) ?? null,
      description: (first('basic.shortDescription') as string | undefined) ?? null,
      ingredients: ingredients.map((item) => item.rawText),
      steps: steps.map((step) => ({
        title: step.title,
        text: step.description,
        imageUrls: step.imageUrls ?? [],
      })),
      servings: (first('recipe.servings') as number | undefined) ?? null,
      prepMinutes: (first('basic.prepMinutes') as number | undefined) ?? null,
      cookMinutes: (first('basic.cookMinutes') as number | undefined) ?? null,
      totalMinutes: (first('recipe.totalMinutes') as number | undefined) ?? null,
      videoUrl: video?.watchUrl ?? video?.contentUrl ?? video?.embedUrl ?? null,
      imageUrl: (first('basic.imageUrl') as string | undefined) ?? null,
      nutrition: hasNutrition ? nutrition : null,
    };
  }

  private readRecipes(body: string, warnings: string[]): JsonObject[] {
    const recipes: JsonObject[] = [];
    const pattern =
      /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi;

    for (const match of body.matchAll(pattern)) {
      const raw = match[1].trim();
      if (!raw) continue;
      try {
        this.collectRecipes(JSON.parse(raw) as unknown, recipes);
      } catch {
        // Một số trang nhúng ký tự điều khiển/HTML comment; thử dọn rồi parse lại.
        try {
          const cleaned = raw
            .replace(/^\s*<!--/, '')
            .replace(/-->\s*$/, '')
            .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
          this.collectRecipes(JSON.parse(cleaned) as unknown, recipes);
        } catch {
          warnings.push('INVALID_JSON_LD_BLOCK');
        }
      }
    }
    if (recipes.length === 0) warnings.push('NO_RECIPE_JSON_LD');
    return recipes;
  }

  private collectRecipes(value: unknown, output: JsonObject[]): void {
    if (Array.isArray(value)) {
      value.forEach((item) => this.collectRecipes(item, output));
      return;
    }
    if (!this.isObject(value)) return;
    if (this.hasRecipeType(value['@type'])) output.push(value);
    if (Array.isArray(value['@graph'])) {
      this.collectRecipes(value['@graph'], output);
    }
    if (this.isObject(value.mainEntity)) this.collectRecipes(value.mainEntity, output);
  }

  private toClaims(
    recipe: JsonObject,
    source: SourceReference,
    recipeIndex: number,
  ): SourceFieldClaim[] {
    const selector = `jsonld:Recipe[${recipeIndex}]`;
    const claims: SourceFieldClaim[] = [];
    const add = (fieldPath: string, value: unknown, confidence = 90) => {
      if (value !== undefined && value !== null && value !== '') {
        claims.push({ fieldPath, value, confidence, source, selector });
      }
    };

    add('basic.name', this.plainText(recipe.name), 95);
    add('basic.shortDescription', this.plainText(recipe.description));
    add('basic.prepMinutes', this.durationMinutes(recipe.prepTime));
    add('basic.cookMinutes', this.durationMinutes(recipe.cookTime));
    add('recipe.totalMinutes', this.durationMinutes(recipe.totalTime));
    add('recipe.servings', this.servings(recipe.recipeYield));
    add('basic.imageUrl', this.imageUrls(recipe.image)[0], 85);

    const ingredients = this.stringList(recipe.recipeIngredient).map(
      (rawText) => ({ rawText }),
    );
    add('ingredients', ingredients);

    const steps = this.instructions(recipe.recipeInstructions);
    add('recipe.steps', steps);

    const video = this.video(recipe.video);
    add('recipe.video', video, 85);

    const nutrition = this.isObject(recipe.nutrition)
      ? recipe.nutrition
      : undefined;
    if (nutrition) {
      add(
        'nutrition.caloriesKcal',
        this.numberFromText(nutrition.calories),
        85,
      );
      add('nutrition.proteinG', this.numberFromText(nutrition.proteinContent), 85);
      add(
        'nutrition.carbsG',
        this.numberFromText(nutrition.carbohydrateContent),
        85,
      );
      add('nutrition.fatG', this.numberFromText(nutrition.fatContent), 85);
      add('nutrition.fiberG', this.numberFromText(nutrition.fiberContent), 85);
      add('nutrition.sodiumMg', this.numberFromText(nutrition.sodiumContent), 85);
    }

    return claims;
  }

  private instructions(value: unknown): JsonLdRecipeStep[] {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    // HowToSection chứa itemListElement -> flatten.
    const flattened: unknown[] = [];
    for (const item of values) {
      if (this.isObject(item) && item['@type'] === 'HowToSection' && Array.isArray(item.itemListElement)) {
        flattened.push(...item.itemListElement);
      } else {
        flattened.push(item);
      }
    }
    return flattened
      .map((item, index) => {
        if (typeof item === 'string') {
          return {
            stepNumber: index + 1,
            title: `Bước ${index + 1}`,
            description: this.plainText(item) ?? '',
            imageUrls: [],
          };
        }
        if (!this.isObject(item)) return undefined;
        const description = this.plainText(item.text ?? item.description);
        if (!description) return undefined;
        return {
          stepNumber: index + 1,
          title: this.plainText(item.name) ?? `Bước ${index + 1}`,
          description,
          imageUrls: this.imageUrls(item.image),
        };
      })
      .filter((step): step is JsonLdRecipeStep => Boolean(step))
      .map((step, index) => ({ ...step, stepNumber: index + 1 }));
  }

  /** `image` có thể là string | string[] | ImageObject | ImageObject[]. */
  private imageUrls(value: unknown): string[] {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    const urls: string[] = [];
    for (const item of values) {
      let url: string | undefined;
      if (typeof item === 'string') url = item;
      else if (this.isObject(item)) {
        url = this.text(item.url) ?? this.text(item.contentUrl) ?? this.text(item['@id']);
      }
      if (url && /^https?:\/\//i.test(url) && !urls.includes(url)) {
        urls.push(decodeHtmlEntities(url.trim()));
      }
    }
    return urls;
  }

  private video(value: unknown): JsonLdRecipeVideo | undefined {
    const item = Array.isArray(value) ? value[0] : value;
    if (!this.isObject(item)) return undefined;
    const embedUrl = this.text(item.embedUrl) ?? null;
    const contentUrl = this.text(item.contentUrl) ?? null;
    const watchUrl = normalizeYoutubeUrl(embedUrl) ?? normalizeYoutubeUrl(contentUrl);
    if (!embedUrl && !contentUrl) return undefined;
    return {
      name: this.plainText(item.name) ?? null,
      description: this.plainText(item.description) ?? null,
      embedUrl,
      contentUrl,
      thumbnailUrl: this.imageUrls(item.thumbnailUrl)[0] ?? null,
      duration: this.durationMinutes(item.duration) ?? null,
      watchUrl,
    };
  }

  private durationMinutes(value: unknown): number | undefined {
    if (typeof value !== 'string') return undefined;
    const match = value.trim().match(
      /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i,
    );
    if (!match) return undefined;
    return (
      Number(match[1] ?? 0) * 1440 +
      Number(match[2] ?? 0) * 60 +
      Number(match[3] ?? 0) +
      Math.ceil(Number(match[4] ?? 0) / 60)
    );
  }

  private servings(value: unknown): number | undefined {
    const parsed = this.numberFromText(
      Array.isArray(value) ? value[0] : value,
    );
    return parsed && parsed > 0 ? Math.round(parsed) : undefined;
  }

  private numberFromText(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string') return undefined;
    const match = value.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : undefined;
  }

  private stringList(value: unknown): string[] {
    const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
    return values
      .map((item) => this.plainText(item))
      .filter((item): item is string => Boolean(item));
  }

  private plainText(value: unknown): string | undefined {
    const text = this.text(value);
    if (!text) return undefined;
    const decoded = decodeHtmlEntities(
      decodeHtmlEntities(text).replace(/<[^>]*>/g, ' '),
    );
    const cleaned = decoded.replace(/\s+/g, ' ').trim();
    return cleaned || undefined;
  }

  private text(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim()
      ? value.trim()
      : undefined;
  }

  private hasRecipeType(value: unknown): boolean {
    return Array.isArray(value)
      ? value.some((type) => type === 'Recipe')
      : value === 'Recipe';
  }

  private isObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
