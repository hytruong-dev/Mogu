import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IngredientImageStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ImageLicensePolicyService } from './image-license-policy.service';
import { ImageRankerService, RankedImageHit } from './image-ranker.service';
import { OpenverseProvider } from './openverse.provider';
import { SafeImageDownloaderService } from './safe-image-downloader.service';
import { WikimediaCommonsProvider } from './wikimedia-commons.provider';
import { WikiLeadImageProvider } from './wiki-lead-image.provider';
import { PixabayProvider } from './pixabay.provider';
import { CommonsCategoryProvider } from './commons-category.provider';
import { ImageVisionVerifierService } from './image-vision-verifier.service';
import { IngredientEntityResolverService } from '../ingredient-entity/ingredient-entity-resolver.service';
import { IngredientMetadataEnrichmentService } from '../ingredient-metadata-enrichment.service';
import type { IngredientImageSearchHit } from './image-provider';

@Injectable()
export class IngredientImageEnrichmentService {
  private readonly logger = new Logger(IngredientImageEnrichmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly resolver: IngredientEntityResolverService,
    private readonly wikiLead: WikiLeadImageProvider,
    private readonly pixabay: PixabayProvider,
    private readonly commonsCategory: CommonsCategoryProvider,
    private readonly wikimedia: WikimediaCommonsProvider,
    private readonly openverse: OpenverseProvider,
    private readonly licensePolicy: ImageLicensePolicyService,
    private readonly ranker: ImageRankerService,
    private readonly visionVerifier: ImageVisionVerifierService,
    private readonly downloader: SafeImageDownloaderService,
    private readonly metadataService: IngredientMetadataEnrichmentService,
  ) {}

  async enrichIngredient(ingredientId: string): Promise<void> {
    const ingredient = await this.prisma.db.ingredient.findUnique({
      where: { id: ingredientId },
      select: {
        id: true,
        name: true,
        nameEn: true,
        imageUrl: true,
        imageStatus: true,
        synonyms: true,
        enrichment: true,
      },
    });
    if (!ingredient) return;

    await this.prisma.db.ingredient.update({
      where: { id: ingredientId },
      data: { imageStatus: IngredientImageStatus.SEARCHING },
    });

    try {
      // 1. Phân giải thực thể (entity-first) qua Wikipedia tiếng Việt + OFF + Wikidata
      const entity = await this.resolver.resolve(
        ingredient.name,
        ingredient.nameEn || undefined,
        ingredient.synonyms,
      );

      // 2. Sinh metadata bổ sung (nameEn, mô tả, synonyms, nhóm...) với ngữ cảnh từ entity
      let nameEn = ingredient.nameEn || entity.enTitle;
      try {
        const meta = await this.metadataService.enrichMetadata(
          ingredientId,
          ingredient.name,
          entity,
        );
        if (meta?.nameEn) nameEn = meta.nameEn;
      } catch (err) {
        this.logger.warn(
          `Metadata enrichment error for ${ingredientId}: ${(err as Error).message}`,
        );
      }

      // 2b. Nếu AI vừa sinh nameEn mà resolver lần đầu chưa có -> bổ sung en.wikipedia/Wikidata
      if (nameEn && nameEn !== ingredient.nameEn) {
        try {
          await this.resolver.enrichWithEnglishName(entity, nameEn, ingredient.name);
        } catch (err) {
          this.logger.debug(
            `enrichWithEnglishName failed for ${ingredientId}: ${(err as Error).message}`,
          );
        }
      }

      // 3. Tìm kiếm ảnh đa tầng (Tier-based Search):
      // Tier A (Wikipedia Lead + Wikidata P18) & Tier B (Pixabay) chạy song song
      const [tierAHits, tierBHits] = await Promise.all([
        this.wikiLead.searchByEntity(entity, 6),
        this.pixabay.searchMultiLanguage(ingredient.name, nameEn || undefined, 6),
      ]);

      const rawHits: IngredientImageSearchHit[] = [...tierAHits, ...tierBHits];

      // Tier C: Commons Category nếu thực thể có danh mục
      if (entity.commonsCategory) {
        const tierCHits = await this.commonsCategory.searchByCategory(
          entity.commonsCategory,
          6,
        );
        rawHits.push(...tierCHits);
      }

      // Tier D: gọi khi tổng ảnh hợp lệ từ A + B + C < 4. Tìm bằng tiếng Anh (nameEn / enTitle)
      const validSoFar = this.licensePolicy.filter(rawHits);
      const enQueries = Array.from(
        new Set(
          [nameEn, entity.enTitle]
            .map((q) => q?.trim().toLowerCase())
            .filter((q): q is string => Boolean(q)),
        ),
      ).slice(0, 2);
      if (validSoFar.length < 4 && enQueries.length) {
        const tierDResults = await Promise.all(
          enQueries.flatMap((q) => [
            this.wikimedia.search(q, 6),
            this.openverse.search(q, 6),
          ]),
        );
        for (const list of tierDResults) rawHits.push(...list);
      }

      this.logger.log(
        `Image search "${ingredient.name}" (en=${nameEn ?? '-'}; qid=${entity.wikidataId ?? '-'}): A=${tierAHits.length} B=${tierBHits.length} total=${rawHits.length}`,
      );

      // Khử trùng theo provider + providerAssetId và tên tệp
      const seen = new Set<string>();
      const dedupedHits = rawHits.filter((hit) => {
        const key = `${hit.provider}:${hit.providerAssetId}`;
        const titleKey = hit.title ? `title:${hit.title.toLowerCase()}` : null;
        if (seen.has(key) || (titleKey && seen.has(titleKey))) return false;
        seen.add(key);
        if (titleKey) seen.add(titleKey);
        return true;
      });

      // Lọc giấy phép bản quyền
      const licensed = this.licensePolicy.filter(dedupedHits);

      // Xếp hạng ứng viên bằng ranker v2
      const ranked: RankedImageHit[] = this.ranker.rank(
        licensed,
        ingredient.name,
        nameEn || undefined,
        entity.aliasesVi,
      );

      if (!ranked.length) {
        await this.prisma.db.ingredient.update({
          where: { id: ingredientId },
          data: { imageStatus: IngredientImageStatus.NOT_FOUND },
        });
        return;
      }

      const autoAssignMinScore = Number(
        this.config.get<string>('INGREDIENT_IMAGE_AUTO_ASSIGN_MIN_SCORE') || 50,
      );

      // 4. Thẩm định AI Vision: duyệt lần lượt theo thứ hạng cho tới khi có 1 ảnh được xác nhận
      //    (tối đa 6 ảnh) để tránh trường hợp top 3 đều sai mà ảnh đúng nằm ở vị trí 4-6.
      const maxVerify = Math.min(ranked.length, 6);
      let confirmedCount = 0;
      const refDesc = entity.descriptionVi || entity.extractVi;
      for (let i = 0; i < maxVerify; i++) {
        if (confirmedCount >= 1 && i >= 3) break;
        const hit = ranked[i];
        const verifyUrl = hit.previewUrl || hit.originalUrl;
        try {
          const visionResult = await this.visionVerifier.verify(
            verifyUrl,
            ingredient.name,
            nameEn || undefined,
            refDesc,
          );
          if (visionResult) {
            hit.scoreBreakdown = {
              ...hit.scoreBreakdown,
              vision: visionResult,
            };
            if (visionResult.matchesName === false) {
              hit.score = Math.min(hit.score, 20);
            } else if (
              visionResult.matchesName === true &&
              visionResult.isIngredient === true
            ) {
              if (visionResult.isRawOrTypicalForm) {
                // Ảnh đúng nguyên liệu, đúng dạng dùng trong bếp: cộng mạnh để vượt ngưỡng auto-assign
                hit.score = Math.min(100, hit.score + 30);
                confirmedCount += 1;
              } else {
                // Đúng nguyên liệu nhưng dạng không tiêu biểu (ảnh kính hiển vi, cây ngoài đồng...):
                // kéo xuống dưới ngưỡng auto-assign để ảnh tiêu biểu ở tier thấp hơn vượt lên;
                // vẫn giữ làm ứng viên cho admin chọn tay
                hit.score = Math.min(hit.score, autoAssignMinScore - 5);
              }
            }
          }
        } catch (err) {
          this.logger.debug(
            `Skip vision verify for ${hit.providerAssetId}: ${(err as Error).message}`,
          );
        }
      }

      // Sắp xếp lại sau khi có điểm thẩm định vision
      ranked.sort((a, b) => b.score - a.score);

      const topCandidates = ranked.slice(0, 5);

      let provisionalAssigned = false;
      let topStoredCandidate: {
        id: string;
        storageKey: string;
        score: number;
      } | null = null;

      for (let i = 0; i < topCandidates.length; i++) {
        const hit = topCandidates[i];
        let storageKey: string | null = null;
        let checksum: string | null = null;
        let width = hit.width ?? null;
        let height = hit.height ?? null;
        let mimeType = hit.mimeType ?? null;

        try {
          let downloaded: Awaited<ReturnType<SafeImageDownloaderService['download']>>;
          try {
            downloaded = await this.downloader.download(hit.originalUrl);
          } catch (primaryErr) {
            // Thử tải bản preview (thumb) nếu bản gốc lỗi / bị rate-limit
            const fallbackUrl = this.buildFallbackDownloadUrl(hit);
            if (fallbackUrl) {
              downloaded = await this.downloader.download(fallbackUrl);
            } else {
              throw primaryErr;
            }
          }
          storageKey = await this.uploadToStorage(
            ingredientId,
            downloaded.checksumSha256,
            downloaded.buffer,
            downloaded.mimeType,
          );
          checksum = downloaded.checksumSha256;
          width = downloaded.width;
          height = downloaded.height;
          mimeType = downloaded.mimeType;
        } catch (err) {
          this.logger.warn(
            `Skip download for ${hit.providerAssetId}: ${(err as Error).message}`,
          );
        }

        const visionMatchesName =
          (hit.scoreBreakdown?.vision as any)?.matchesName !== false;

        const isEligibleForProvisional =
          Boolean(storageKey) &&
          hit.score >= autoAssignMinScore &&
          visionMatchesName &&
          !provisionalAssigned &&
          !ingredient.imageUrl;

        const candidateStatus = isEligibleForProvisional
          ? 'PROVISIONAL'
          : storageKey
            ? 'STORED'
            : 'FOUND';

        const upserted = await this.prisma.db.ingredientImageCandidate.upsert({
          where: {
            ingredientId_provider_providerAssetId: {
              ingredientId,
              provider: hit.provider,
              providerAssetId: hit.providerAssetId,
            },
          },
          create: {
            ingredientId,
            provider: hit.provider,
            providerAssetId: hit.providerAssetId,
            sourcePageUrl: hit.sourcePageUrl,
            originalUrl: hit.originalUrl,
            previewUrl: hit.previewUrl,
            author: hit.author,
            authorUrl: hit.authorUrl,
            licenseCode: hit.licenseCode,
            licenseUrl: hit.licenseUrl,
            width,
            height,
            mimeType,
            score: hit.score,
            scoreBreakdown: hit.scoreBreakdown as Prisma.InputJsonValue,
            status: candidateStatus,
            storageKey,
            checksumSha256: checksum,
          },
          update: {
            sourcePageUrl: hit.sourcePageUrl,
            originalUrl: hit.originalUrl,
            previewUrl: hit.previewUrl,
            author: hit.author,
            authorUrl: hit.authorUrl,
            licenseCode: hit.licenseCode,
            licenseUrl: hit.licenseUrl,
            width,
            height,
            mimeType,
            score: hit.score,
            scoreBreakdown: hit.scoreBreakdown as Prisma.InputJsonValue,
            status: candidateStatus,
            storageKey,
            checksumSha256: checksum,
            fetchedAt: new Date(),
          },
        });

        if (isEligibleForProvisional && storageKey) {
          provisionalAssigned = true;
          topStoredCandidate = {
            id: upserted.id,
            storageKey,
            score: hit.score,
          };
        }
      }

      // 5. Gán ảnh tạm cho nguyên liệu nếu đủ điều kiện
      if (topStoredCandidate && !ingredient.imageUrl) {
        const publicUrl = this.buildPublicUrl(topStoredCandidate.storageKey);
        await this.prisma.db.ingredient.update({
          where: { id: ingredientId },
          data: {
            imageUrl: publicUrl,
            imageKey: topStoredCandidate.storageKey,
            imageStatus: IngredientImageStatus.PENDING_REVIEW,
          },
        });
        this.logger.log(
          `Auto-assigned provisional image to ingredient ${ingredientId} (score: ${topStoredCandidate.score})`,
        );
      } else {
        await this.prisma.db.ingredient.update({
          where: { id: ingredientId },
          data: { imageStatus: IngredientImageStatus.PENDING_REVIEW },
        });
      }
    } catch (err) {
      this.logger.error(
        `Enrichment failed for ${ingredientId}: ${(err as Error).message}`,
      );
      await this.prisma.db.ingredient.update({
        where: { id: ingredientId },
        data: { imageStatus: IngredientImageStatus.FAILED },
      });
      throw err;
    }
  }

  /**
   * URL dự phòng khi tải ảnh gốc thất bại:
   * - Wikimedia: dùng Special:FilePath?width=1200 (host commons.wikimedia.org, đi qua thumbor,
   *   ít bị rate-limit hơn upload.wikimedia.org và tự chọn định dạng)
   * - Nguồn khác: previewUrl nếu khác originalUrl
   */
  private buildFallbackDownloadUrl(hit: IngredientImageSearchHit): string | null {
    const isWikimedia =
      hit.provider === 'wikipedia_lead' ||
      hit.provider === 'wikidata_p18' ||
      hit.provider === 'commons_category' ||
      hit.provider === 'wikimedia_commons';
    if (isWikimedia && hit.title) {
      const fileName = hit.title.replace(/^File:/i, '').trim();
      if (fileName) {
        return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=1200`;
      }
    }
    if (hit.previewUrl && hit.previewUrl !== hit.originalUrl) {
      return hit.previewUrl;
    }
    return null;
  }

  private buildPublicUrl(storageKey: string): string {
    const supabaseUrl = this.config.get<string>('SUPABASE_URL', '');
    return `${supabaseUrl}/storage/v1/object/public/ingredient-images/${storageKey}`;
  }

  private async uploadToStorage(
    ingredientId: string,
    checksum: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      this.config.get<string>('SUPABASE_URL', ''),
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY', ''),
    );
    const path = `provider/${ingredientId}/${checksum}.webp`;
    const { error } = await supabase.storage
      .from('ingredient-images')
      .upload(path, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error && !/already exists|Duplicate/i.test(error.message)) {
      throw new Error(error.message);
    }
    return path;
  }
}
