import { Injectable } from '@nestjs/common';
import type { IngredientImageSearchHit } from './image-provider';

export interface RankedImageHit extends IngredientImageSearchHit {
  score: number;
  scoreBreakdown: Record<string, number | any>;
}

@Injectable()
export class ImageRankerService {
  rank(
    hits: IngredientImageSearchHit[],
    ingredientName: string,
    englishName?: string,
    aliases: string[] = [],
  ): RankedImageHit[] {
    const nameFold = this.fold(ingredientName);
    const enFold = englishName ? this.fold(englishName) : '';
    const aliasFolds = aliases.map((a) => this.fold(a)).filter(Boolean);

    return hits
      .filter((hit) => {
        // Loại bỏ hoàn toàn tệp SVG hoặc đồ họa vector/biểu đồ cấu trúc
        const mime = (hit.mimeType || '').toLowerCase();
        const url = hit.originalUrl.toLowerCase();
        const title = (hit.title || '').toLowerCase();
        if (
          mime.includes('svg') ||
          url.endsWith('.svg') ||
          title.endsWith('.svg')
        ) {
          return false;
        }
        return true;
      })
      .map((hit) => {
        const titleFold = this.fold(hit.title ?? '');
        const descFold = this.fold(hit.description ?? '');
        const tagsFold = (hit.tags ?? []).map((t) => this.fold(t));
        const combinedText = `${hit.title ?? ''} ${hit.description ?? ''} ${(hit.tags ?? []).join(' ')}`;

        // 1. So khớp tên (nameExact)
        let nameExact = 0;
        const targetFolds = [nameFold, enFold, ...aliasFolds].filter(Boolean);

        const exactTitleMatch = targetFolds.some((tf) => titleFold === tf);
        const partialTitleMatch = targetFolds.some(
          (tf) =>
            tf.length >= 3 &&
            (titleFold.includes(tf) || (tf.includes(titleFold) && titleFold.length >= 3)),
        );
        const tagExactMatch = tagsFold.some((tg) => targetFolds.includes(tg));
        const descMatch = targetFolds.some(
          (tf) => tf.length >= 3 && descFold.includes(tf),
        );

        if (exactTitleMatch) {
          nameExact = 40;
        } else if (partialTitleMatch || tagExactMatch) {
          nameExact = 25;
        } else if (descMatch) {
          nameExact = 15;
        }

        // 2. Điểm khớp thực thể (entityMatch từ Tier A)
        const entityMatchScore = hit.entityMatch ? 20 : 0;

        // 3. Trọng số nguồn (Tier A: 30, Tier B: 18, Tier C: 15, Tier D: 10/8)
        let source = 5;
        if (
          hit.provider === 'wikipedia_lead' ||
          hit.provider === 'wikidata_p18'
        ) {
          source = 30;
        } else if (hit.provider === 'pixabay') {
          source = 18;
        } else if (hit.provider === 'commons_category') {
          source = 15;
        } else if (hit.provider === 'wikimedia_commons') {
          source = 10;
        } else if (hit.provider === 'openverse') {
          source = 8;
        }

        // 4. Trạng thái thực phẩm tươi/thô
        const foodState = /raw|fresh|ingredient|thô|tươi|củ|quả|hạt|lá|thịt/i.test(
          combinedText,
        )
          ? 10
          : 0;

        // 5. Chất lượng kích thước
        const width = hit.width ?? 0;
        const height = hit.height ?? 0;
        const quality =
          width >= 600 && height >= 600
            ? 10
            : width >= 400 && height >= 400
              ? 6
              : 2;

        // 6. Giấy phép
        const license = /cc0|public domain|pixabay/i.test(hit.licenseCode)
          ? 10
          : 6;

        // 7. Điểm phạt (penalties)
        let penalty = 0;
        if (
          /logo|band|album|poster|cartoon|drawing|illustration|structure|molecule|diagram|map|clipart/i.test(
            combinedText,
          )
        ) {
          penalty -= 30;
        }
        if (
          /dish|recipe|plate|cooked meal|restaurant|menu|soup|stew|curry|salad|sandwich|burger|pizza|cocktail|dessert|cake|món|quán|nhà hàng/i.test(
            combinedText,
          ) &&
          !hit.entityMatch
        ) {
          penalty -= 20;
        }
        if (
          /mountain|lake|beach|river|island|landscape|mural|painting|mosaic|statue|museum|dog|cat|pet|người|portrait/i.test(
            combinedText,
          ) &&
          !hit.entityMatch
        ) {
          penalty -= 25;
        }
        if (/watermark|shutterstock|getty/i.test(combinedText)) {
          penalty -= 30;
        }

        const score = Math.max(
          0,
          Math.min(
            100,
            nameExact +
              entityMatchScore +
              foodState +
              quality +
              license +
              source +
              penalty,
          ),
        );

        return {
          ...hit,
          score,
          scoreBreakdown: {
            nameExact,
            entityMatchScore,
            foodState,
            quality,
            license,
            source,
            penalty,
          },
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  private fold(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u0111/g, 'd')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
