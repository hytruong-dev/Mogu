import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IngredientImageStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ImageLicensePolicyService } from './image-license-policy.service';
import { ImageRankerService } from './image-ranker.service';
import { OpenverseProvider } from './openverse.provider';
import { SafeImageDownloaderService } from './safe-image-downloader.service';
import { WikimediaCommonsProvider } from './wikimedia-commons.provider';

@Injectable()
export class IngredientImageEnrichmentService {
  private readonly logger = new Logger(IngredientImageEnrichmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly wikimedia: WikimediaCommonsProvider,
    private readonly openverse: OpenverseProvider,
    private readonly licensePolicy: ImageLicensePolicyService,
    private readonly ranker: ImageRankerService,
    private readonly downloader: SafeImageDownloaderService,
  ) {}

  async enrichIngredient(ingredientId: string): Promise<void> {
    const ingredient = await this.prisma.db.ingredient.findUnique({
      where: { id: ingredientId },
      select: { id: true, name: true, imageStatus: true },
    });
    if (!ingredient) return;

    await this.prisma.db.ingredient.update({
      where: { id: ingredientId },
      data: { imageStatus: IngredientImageStatus.SEARCHING },
    });

    try {
      const rawHits = [
        ...(await this.wikimedia.search(ingredient.name, 8)),
        ...(await this.openverse.search(ingredient.name, 6)),
      ];
      const licensed = this.licensePolicy.filter(rawHits);
      const ranked = this.ranker.rank(licensed, ingredient.name).slice(0, 5);

      if (!ranked.length) {
        await this.prisma.db.ingredient.update({
          where: { id: ingredientId },
          data: { imageStatus: IngredientImageStatus.NOT_FOUND },
        });
        return;
      }

      for (const hit of ranked) {
        let storageKey: string | null = null;
        let checksum: string | null = null;
        let width = hit.width ?? null;
        let height = hit.height ?? null;
        let mimeType = hit.mimeType ?? null;

        try {
          const downloaded = await this.downloader.download(hit.originalUrl);
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

        await this.prisma.db.ingredientImageCandidate.upsert({
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
            status: storageKey ? 'STORED' : 'FOUND',
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
            status: storageKey ? 'STORED' : 'FOUND',
            storageKey,
            checksumSha256: checksum,
            fetchedAt: new Date(),
          },
        });
      }

      await this.prisma.db.ingredient.update({
        where: { id: ingredientId },
        data: { imageStatus: IngredientImageStatus.PENDING_REVIEW },
      });
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
