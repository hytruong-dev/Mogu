import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { FoodScanExtraction } from './dto/food-scan.dto';

export const FOOD_SCAN_REPORT_DEDUPE_DAYS = 30;

export interface CreateMissingDishReportInput {
  scanEventId: string;
  userId?: string | null;
  /** Validated/re-encoded JPEG (output of validateFoodScanImage). */
  image?: Buffer | null;
  imagePhash?: string | null;
  extraction: FoodScanExtraction | null;
  suggestedDishIds?: string[];
  source: 'AUTO' | 'USER';
}

/**
 * Queues dishes the scanner could not find in the catalog, so admins can add them.
 * Everything here is best-effort: a failure must never fail the scan request.
 */
@Injectable()
export class FoodScanReportService {
  private readonly logger = new Logger(FoodScanReportService.name);
  private supabase: SupabaseClient | null | undefined;
  readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.bucket =
      this.config.get<string>('FOOD_SCAN_REPORT_BUCKET') || 'food-scan-reports';
  }

  private client(): SupabaseClient | null {
    if (this.supabase !== undefined) return this.supabase;
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.supabase =
      url && key
        ? createClient(url, key, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : null;
    return this.supabase;
  }

  /** Upload image to the private reports bucket; returns storage key or null. */
  async uploadImage(image: Buffer): Promise<string | null> {
    const supabase = this.client();
    if (!supabase) return null;
    const now = new Date();
    const key = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.jpg`;
    const { error } = await supabase.storage
      .from(this.bucket)
      .upload(key, image, { contentType: 'image/jpeg', upsert: false });
    if (error) {
      this.logger.warn(`Upload food scan report image failed: ${error.message}`);
      return null;
    }
    return key;
  }

  async signedImageUrl(
    bucket: string | null,
    key: string | null,
    expiresInSeconds = 3600,
  ): Promise<string | null> {
    const supabase = this.client();
    if (!supabase || !bucket || !key) return null;
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(key, expiresInSeconds);
    return error || !data ? null : data.signedUrl;
  }

  /**
   * Create a report or bump an existing one:
   * - same scan (1 report per scan; USER source upgrades AUTO),
   * - same image pHash within 30 days (still open) -> report_count + 1.
   */
  async createOrBump(
    input: CreateMissingDishReportInput,
  ): Promise<{ id: string; created: boolean } | null> {
    try {
      const db = this.prisma.db;
      const byScan = await db.foodScanMissingDishReport.findFirst({
        where: { scanEventId: input.scanEventId },
        select: { id: true, imageStorageKey: true },
      });
      if (byScan) {
        const data: Record<string, unknown> = {};
        if (input.source === 'USER') data.source = 'USER';
        if (!byScan.imageStorageKey && input.image) {
          const key = await this.uploadImage(input.image);
          if (key) {
            data.imageBucket = this.bucket;
            data.imageStorageKey = key;
          }
        }
        if (Object.keys(data).length) {
          await db.foodScanMissingDishReport.update({
            where: { id: byScan.id },
            data,
          });
        }
        return { id: byScan.id, created: false };
      }

      if (input.imagePhash) {
        const since = new Date(
          Date.now() - FOOD_SCAN_REPORT_DEDUPE_DAYS * 24 * 3600 * 1000,
        );
        const dup = await db.foodScanMissingDishReport.findFirst({
          where: {
            imagePhash: input.imagePhash,
            createdAt: { gte: since },
            status: { in: ['NEW', 'IN_PROGRESS'] },
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        });
        if (dup) {
          await db.foodScanMissingDishReport.update({
            where: { id: dup.id },
            data: {
              reportCount: { increment: 1 },
              ...(input.source === 'USER' ? { source: 'USER' } : {}),
            },
          });
          return { id: dup.id, created: false };
        }
      }

      const key = input.image ? await this.uploadImage(input.image) : null;
      const extraction = input.extraction;
      const report = await db.foodScanMissingDishReport.create({
        data: {
          scanEventId: input.scanEventId,
          userId: input.userId ?? null,
          imageBucket: key ? this.bucket : null,
          imageStorageKey: key,
          imagePhash: input.imagePhash ?? null,
          recognizedName:
            extraction?.primaryName ?? extraction?.guesses?.[0]?.nameVi ?? null,
          guesses: (extraction?.guesses ?? []) as object[],
          category: extraction?.category ?? null,
          cuisine: extraction?.cuisine ?? null,
          visibleIngredients: extraction?.visibleIngredients ?? [],
          suggestedDishIds: input.suggestedDishIds ?? [],
          source: input.source,
        },
        select: { id: true },
      });
      return { id: report.id, created: true };
    } catch (e) {
      this.logger.warn(`Could not create missing dish report: ${e}`);
      return null;
    }
  }
}
