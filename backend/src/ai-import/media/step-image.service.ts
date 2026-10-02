import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { ExtractedRecipeStep, RecipeEvidence } from '../ai-import.types';

export interface StepImageAssignment {
  step: number;
  imageUrl: string;
  storageKey: string;
  sourceUrl: string;
  sourceStepIndex: number;
  credit: string;
  matchedBy: 'INDEX' | 'TITLE';
}

export interface StepImageResult {
  assignments: StepImageAssignment[];
  /** Số bước AI không có ảnh (sau khi thử mọi nguồn). */
  missingSteps: number[];
  warnings: string[];
}

export interface StepImageUploader {
  /** Trả public URL + storageKey, hoặc null nếu tải/upload thất bại. */
  upload(imageUrl: string, storageKey: string): Promise<{ publicUrl: string; storageKey: string } | null>;
}

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 3 * 1024 * 1024;

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

function similarity(a: string, b: string): number {
  const wa = new Set(comparable(a).split(' ').filter((w) => w.length > 1));
  const wb = new Set(comparable(b).split(' ').filter((w) => w.length > 1));
  if (!wa.size || !wb.size) return 0;
  let hits = 0;
  for (const w of wa) if (wb.has(w)) hits += 1;
  return hits / Math.max(wa.size, wb.size);
}

/**
 * Tải ảnh từng bước nấu từ nguồn JSON-LD (HowToStep.image) lên Supabase Storage
 * và gán vào recipeSteps[n].imageUrl. Ảnh được lưu kèm credit/sourceUrl; media
 * moderation ở mức dish vẫn PENDING (admin duyệt trước khi publish).
 */
@Injectable()
export class StepImageService {
  private readonly logger = new Logger(StepImageService.name);
  private readonly supabase: SupabaseClient | null;
  private readonly bucket = 'dish-images';

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.supabase = url && key
      ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
      : null;
  }

  /**
   * Map bước nguồn -> bước AI theo index (nếu số bước bằng nhau) hoặc độ giống title/mô tả.
   * `evidences` theo thứ tự ưu tiên; bước không có ảnh ở nguồn 1 sẽ thử nguồn 2/3.
   */
  async attach(input: {
    jobId: string;
    steps: ExtractedRecipeStep[];
    evidences: RecipeEvidence[];
    uploader?: StepImageUploader;
  }): Promise<StepImageResult> {
    const result: StepImageResult = { assignments: [], missingSteps: [], warnings: [] };
    const evidences = input.evidences.filter((e) => e.steps.some((s) => s.imageUrls?.length));
    if (!input.steps.length) return result;
    if (!evidences.length) {
      result.missingSteps = input.steps.map((s) => s.stepNumber);
      result.warnings.push('STEP_IMAGE_MISSING');
      return result;
    }
    const uploader = input.uploader ?? this.defaultUploader();

    for (const [aiIndex, aiStep] of input.steps.entries()) {
      let assigned: StepImageAssignment | null = null;
      for (const evidence of evidences) {
        const match = this.matchSourceStep(aiStep, aiIndex, input.steps.length, evidence);
        if (!match) continue;
        const candidates = evidence.steps[match.index].imageUrls ?? [];
        for (const imageUrl of candidates) {
          const storageKey = `dishes/${input.jobId}/steps/step-${aiStep.stepNumber}.${this.extFromUrl(imageUrl)}`;
          const uploaded = await uploader.upload(imageUrl, storageKey);
          if (!uploaded) continue;
          assigned = {
            step: aiStep.stepNumber,
            imageUrl: uploaded.publicUrl,
            storageKey: uploaded.storageKey,
            sourceUrl: imageUrl,
            sourceStepIndex: match.index,
            credit: evidence.sourceDomain ?? this.domainOf(evidence.sourceUrl),
            matchedBy: match.by,
          };
          break;
        }
        if (assigned) break;
      }
      if (assigned) result.assignments.push(assigned);
      else result.missingSteps.push(aiStep.stepNumber);
    }
    if (result.missingSteps.length) result.warnings.push('STEP_IMAGE_MISSING');
    return result;
  }

  private matchSourceStep(
    aiStep: ExtractedRecipeStep,
    aiIndex: number,
    aiCount: number,
    evidence: RecipeEvidence,
  ): { index: number; by: 'INDEX' | 'TITLE' } | null {
    const sourceSteps = evidence.steps;
    if (!sourceSteps.length) return null;
    // Cùng số bước -> map theo index (đã yêu cầu AI giữ thứ tự nguồn).
    if (sourceSteps.length === aiCount && sourceSteps[aiIndex]?.imageUrls?.length) {
      return { index: aiIndex, by: 'INDEX' };
    }
    // Khác số bước -> chọn bước nguồn giống nhất (title + description), ngưỡng 0.25.
    const aiText = `${aiStep.title} ${aiStep.description}`;
    let bestIndex = -1;
    let bestScore = -1;
    sourceSteps.forEach((source, index) => {
      if (!source.imageUrls?.length) return;
      const score = Math.max(
        similarity(aiStep.title, source.title ?? ''),
        similarity(aiText, `${source.title ?? ''} ${source.text}`),
      );
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    if (bestIndex >= 0 && bestScore >= 0.25) return { index: bestIndex, by: 'TITLE' };
    // Fallback: ánh xạ tỉ lệ theo vị trí nếu còn ảnh.
    const proportional = Math.min(
      sourceSteps.length - 1,
      Math.floor((aiIndex / Math.max(1, aiCount)) * sourceSteps.length),
    );
    if (sourceSteps[proportional]?.imageUrls?.length) return { index: proportional, by: 'INDEX' };
    return null;
  }

  private defaultUploader(): StepImageUploader {
    return {
      upload: async (imageUrl, storageKey) => this.downloadAndUpload(imageUrl, storageKey),
    };
  }

  /** SSRF-safe tải ảnh (giới hạn 3MB, MIME jpeg/png/webp) rồi upload Supabase. */
  async downloadAndUpload(
    imageUrl: string,
    storageKey: string,
  ): Promise<{ publicUrl: string; storageKey: string } | null> {
    if (!this.supabase) return null;
    try {
      const url = new URL(imageUrl);
      if (!['http:', 'https:'].includes(url.protocol)) return null;
      if (!(await this.isPublicHost(url.hostname))) return null;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      let res: Response;
      try {
        res = await fetch(url, {
          signal: controller.signal,
          redirect: 'follow',
          headers: { accept: 'image/*', 'user-agent': 'Mogu-AI-Import-Source/1.2' },
        });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) return null;
      const mimeType = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
      if (!ALLOWED_MIME.has(mimeType)) return null;
      const declared = Number(res.headers.get('content-length'));
      if (Number.isFinite(declared) && declared > MAX_BYTES) return null;
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.byteLength > MAX_BYTES || buffer.byteLength === 0) return null;

      const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
      const finalKey = storageKey.replace(/\.[a-z0-9]+$/i, `.${ext}`);
      const { error } = await this.supabase.storage
        .from(this.bucket)
        .upload(finalKey, buffer, { contentType: mimeType, upsert: true });
      if (error) {
        this.logger.warn(`Step image upload failed (${finalKey}): ${error.message}`);
        return null;
      }
      const { data } = this.supabase.storage.from(this.bucket).getPublicUrl(finalKey);
      return { publicUrl: data.publicUrl, storageKey: finalKey };
    } catch (error) {
      this.logger.warn(`Step image download failed (${imageUrl}): ${(error as Error).message}`);
      return null;
    }
  }

  private async isPublicHost(hostname: string): Promise<boolean> {
    const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (normalized === 'localhost' || normalized.endsWith('.localhost') || normalized.endsWith('.local')) return false;
    try {
      const addresses = isIP(normalized)
        ? [{ address: normalized }]
        : await lookup(normalized, { all: true, verbatim: true });
      return addresses.length > 0 && addresses.every(({ address }) => this.isPublicAddress(address));
    } catch {
      return false;
    }
  }

  private isPublicAddress(address: string): boolean {
    if (address.includes(':')) {
      const v = address.toLowerCase();
      return !(v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd')
        || /^fe[89ab]/.test(v) || v.startsWith('2001:db8:') || v.startsWith('::ffff:'));
    }
    const parts = address.split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p))) return false;
    const [a, b] = parts;
    return !(a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 0) || (a === 192 && b === 168)
      || (a === 198 && (b === 18 || b === 19)) || a >= 224);
  }

  private extFromUrl(url: string): string {
    const match = url.toLowerCase().match(/\.(jpe?g|png|webp)(?:[?#]|$)/);
    return match ? (match[1] === 'jpeg' ? 'jpg' : match[1]) : 'jpg';
  }

  private domainOf(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }
}
