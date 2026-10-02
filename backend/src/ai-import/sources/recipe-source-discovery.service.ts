import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RecipeEvidence } from '../ai-import.types';
import { JsonLdWebsiteAdapter, normalizeYoutubeUrl } from './json-ld-website.adapter';
import { SafeSourceFetcherService } from './safe-source-fetcher.service';
import { SourceIntegrationConfigService } from './source-integration-config.service';

/** Domain công thức Việt uy tín (có Schema.org Recipe JSON-LD). */
export const DEFAULT_RECIPE_TRUSTED_DOMAINS = [
  'dienmayxanh.com',
  'cooky.vn',
  'monngonmoingay.com',
  'vnexpress.net',
  'huongnghiepaau.com',
];

export interface WebSearchProvider {
  searchWeb(
    query: string,
    options?: { includeDomains?: string[]; maxResults?: number },
  ): Promise<Array<{ url: string; title: string; content?: string; score?: number }>>;
}

export interface DiscoveredRecipeSource {
  url: string;
  domain: string;
  title: string | null;
  evidence: RecipeEvidence;
  stepImageCount: number;
  stepsWithImages: number;
  hasVideo: boolean;
  titleMatches: boolean;
  score: number;
}

export interface RecipeDiscoveryResult {
  candidates: Array<{ url: string; title: string }>;
  sources: DiscoveredRecipeSource[];
  best: DiscoveredRecipeSource | null;
  videoUrl: string | null;
  videoTitle: string | null;
  videoSource: 'JSON_LD' | 'TAVILY_YOUTUBE' | null;
  warnings: string[];
}

function comparable(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function titleMatchesDish(title: string, dishName: string): boolean {
  const normalizedTitle = comparable(title);
  const normalizedDish = comparable(dishName);
  if (!normalizedTitle || !normalizedDish) return false;
  if (normalizedTitle.includes(normalizedDish)) return true;
  const words = normalizedDish.split(' ').filter((word) => word.length > 1);
  return words.length > 0
    && words.filter((word) => normalizedTitle.includes(word)).length / words.length >= 0.7;
}

/**
 * Bước SEARCHING thật: Tavily (trusted domains) -> SafeFetcher -> JSON-LD Recipe -> chọn nguồn tốt nhất.
 * Hoàn toàn fail-soft: mọi lỗi mạng/parse chỉ sinh warning, pipeline vẫn tiếp tục không có evidence.
 */
@Injectable()
export class RecipeSourceDiscoveryService {
  private readonly logger = new Logger(RecipeSourceDiscoveryService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly flags: SourceIntegrationConfigService,
    private readonly fetcher: SafeSourceFetcherService,
    private readonly jsonLd: JsonLdWebsiteAdapter,
  ) {}

  trustedDomains(): string[] {
    const raw = this.config.get<string>('AI_IMPORT_RECIPE_TRUSTED_DOMAINS') ?? '';
    const list = raw.split(',').map((item) => item.trim()).filter(Boolean);
    return list.length ? list : DEFAULT_RECIPE_TRUSTED_DOMAINS;
  }

  async discover(
    dishName: string,
    search: WebSearchProvider,
    options: { maxCandidates?: number; includeVideo?: boolean } = {},
  ): Promise<RecipeDiscoveryResult> {
    const result: RecipeDiscoveryResult = {
      candidates: [],
      sources: [],
      best: null,
      videoUrl: null,
      videoTitle: null,
      videoSource: null,
      warnings: [],
    };
    if (!this.flags.websiteJsonLdEnabled()) {
      result.warnings.push('WEBSITE_JSONLD_DISABLED');
      return result;
    }

    const maxCandidates = options.maxCandidates ?? 3;
    const domains = this.trustedDomains();
    const query = `cách nấu ${dishName}`;
    const seen = new Set<string>();
    const pushHit = (hit: { url: string; title: string }): boolean => {
      const key = hit.url.replace(/^https?:\/\/(www\.)?/i, '').replace(/[#?].*$/, '').replace(/\/$/, '');
      if (seen.has(key)) return false;
      seen.add(key);
      if (!this.isTrusted(hit.url, domains)) return false;
      if (!titleMatchesDish(hit.title ?? '', dishName)) return false;
      result.candidates.push({ url: hit.url, title: hit.title });
      return true;
    };

    // Tìm theo TỪNG domain theo thứ tự ưu tiên (DMX/Cooky có ảnh bước + video) rồi mới gộp
    // chung: khi gộp include_domains, Tavily thường trả toàn vnexpress/huongnghiepaau.
    for (const domain of domains) {
      if (result.candidates.length >= maxCandidates) break;
      const hits = await search.searchWeb(query, { includeDomains: [domain], maxResults: 3 });
      for (const hit of hits) {
        if (pushHit(hit)) break; // 1 URL tốt nhất mỗi domain
      }
    }
    if (result.candidates.length < maxCandidates) {
      for (const q of [query, `cách làm ${dishName}`]) {
        if (result.candidates.length >= maxCandidates) break;
        const hits = await search.searchWeb(q, { includeDomains: domains, maxResults: 5 });
        for (const hit of hits) {
          pushHit(hit);
          if (result.candidates.length >= maxCandidates) break;
        }
      }
    }
    if (!result.candidates.length) {
      result.warnings.push('NO_RECIPE_SOURCE_FOUND');
    }

    for (const candidate of result.candidates) {
      const source = await this.extractCandidate(candidate.url, dishName, result.warnings);
      if (source) result.sources.push(source);
    }
    result.sources.sort((a, b) => b.score - a.score);
    result.best = result.sources[0] ?? null;

    // Video: JSON-LD VideoObject của bất kỳ nguồn nào -> Tavily youtube.
    const fromJsonLd = result.sources.find((source) => source.evidence.videoUrl);
    if (fromJsonLd?.evidence.videoUrl) {
      result.videoUrl = normalizeYoutubeUrl(fromJsonLd.evidence.videoUrl) ?? fromJsonLd.evidence.videoUrl;
      result.videoTitle = fromJsonLd.title;
      result.videoSource = 'JSON_LD';
    } else if (options.includeVideo !== false) {
      const video = await this.findYoutubeVideo(dishName, search);
      if (video) {
        result.videoUrl = video.url;
        result.videoTitle = video.title;
        result.videoSource = 'TAVILY_YOUTUBE';
      } else {
        result.warnings.push('NO_VIDEO_FOUND');
      }
    }
    return result;
  }

  async findYoutubeVideo(
    dishName: string,
    search: WebSearchProvider,
  ): Promise<{ url: string; title: string } | null> {
    try {
      const hits = await search.searchWeb(`cách nấu ${dishName}`, {
        includeDomains: ['youtube.com'],
        maxResults: 5,
      });
      for (const hit of hits) {
        const url = normalizeYoutubeUrl(hit.url);
        if (!url) continue;
        if (!titleMatchesDish(hit.title ?? '', dishName)) continue;
        return { url, title: hit.title };
      }
    } catch (error) {
      this.logger.warn(`YouTube search failed: ${(error as Error).message}`);
    }
    return null;
  }

  private async extractCandidate(
    url: string,
    dishName: string,
    warnings: string[],
  ): Promise<DiscoveredRecipeSource | null> {
    try {
      const fetched = await this.fetcher.fetch(url);
      const request = {
        uri: fetched.finalUrl,
        contentType: fetched.contentType,
        body: fetched.body,
      };
      if (!this.jsonLd.supports(request)) {
        warnings.push(`NO_JSON_LD:${this.domainOf(url)}`);
        return null;
      }
      const extraction = await this.jsonLd.extract(request);
      const evidence = this.jsonLd.toRecipeEvidence(extraction);
      if (!evidence || (!evidence.steps.length && !evidence.ingredients.length)) {
        warnings.push(`NO_RECIPE_JSON_LD:${this.domainOf(url)}`);
        return null;
      }
      const stepsWithImages = evidence.steps.filter((step) => step.imageUrls?.length).length;
      const stepImageCount = evidence.steps.reduce((sum, step) => sum + (step.imageUrls?.length ?? 0), 0);
      const titleMatches = titleMatchesDish(evidence.title ?? '', dishName);
      const hasVideo = Boolean(evidence.videoUrl);
      const score =
        (titleMatches ? 50 : 0)
        + Math.min(20, evidence.steps.length * 3)
        + Math.min(20, stepsWithImages * 5)
        + (hasVideo ? 10 : 0)
        + (evidence.nutrition ? 5 : 0)
        + Math.min(10, evidence.ingredients.length);
      return {
        url: fetched.finalUrl,
        domain: this.domainOf(fetched.finalUrl),
        title: evidence.title ?? null,
        evidence,
        stepImageCount,
        stepsWithImages,
        hasVideo,
        titleMatches,
        score,
      };
    } catch (error) {
      this.logger.warn(`Source fetch/extract failed for ${url}: ${(error as Error).message}`);
      warnings.push(`SOURCE_FETCH_FAILED:${this.domainOf(url)}`);
      return null;
    }
  }

  private isTrusted(url: string, domains: string[]): boolean {
    const host = this.domainOf(url);
    return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  }

  private domainOf(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return url;
    }
  }
}
