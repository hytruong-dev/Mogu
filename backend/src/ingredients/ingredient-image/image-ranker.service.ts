import { Injectable } from '@nestjs/common';
import type { IngredientImageSearchHit } from './image-provider';

export interface RankedImageHit extends IngredientImageSearchHit {
  score: number;
  scoreBreakdown: Record<string, number>;
}

@Injectable()
export class ImageRankerService {
  rank(
    hits: IngredientImageSearchHit[],
    ingredientName: string,
  ): RankedImageHit[] {
    const nameFold = this.fold(ingredientName);
    return hits
      .map((hit) => {
        const titleFold = this.fold(hit.title ?? '');
        const descFold = this.fold(hit.description ?? '');
        let nameExact = 0;
        if (titleFold === nameFold) nameExact = 40;
        else if (titleFold.includes(nameFold) || nameFold.includes(titleFold))
          nameExact = 25;
        else if (descFold.includes(nameFold)) nameExact = 15;

        const foodState = /raw|fresh|ingredient|thô|tươi/i.test(
          `${hit.title} ${hit.description}`,
        )
          ? 10
          : 0;
        const quality =
          (hit.width ?? 0) >= 400 && (hit.height ?? 0) >= 400 ? 10 : 4;
        const license = /cc0|public domain/i.test(hit.licenseCode) ? 10 : 6;
        const source =
          hit.provider === 'wikimedia_commons'
            ? 10
            : hit.provider === 'openverse'
              ? 7
              : 3;

        let penalty = 0;
        if (/dish|recipe|plate|cooked meal|món/i.test(`${hit.title}`))
          penalty -= 20;
        if (/watermark|logo|stock/i.test(`${hit.title} ${hit.description}`))
          penalty -= 30;

        const score = Math.max(
          0,
          Math.min(
            100,
            nameExact + foodState + quality + license + source + penalty,
          ),
        );
        return {
          ...hit,
          score,
          scoreBreakdown: {
            nameExact,
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
