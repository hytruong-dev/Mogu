import { Injectable } from '@nestjs/common';

@Injectable()
export class IngredientNormalizerService {
  /** Strip parenthetical notes and "hoặc/hay ..." tails. */
  cleanDisplayName(raw: string): string {
    return (raw ?? '')
      .normalize('NFKC')
      .replace(/\s*\(.*?\)\s*/g, ' ')
      .replace(/\s*(hoặc|hoac|hay)\s+.*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Identity key: keep Vietnamese diacritics, lowercase, collapse spaces. */
  identityKey(raw: string): string {
    return this.cleanDisplayName(raw)
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200);
  }

  /** Folded search key: strip diacritics for suggestion ranking only. */
  searchFolded(raw: string): string {
    return this.cleanDisplayName(raw)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u0111/g, 'd')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200);
  }

  slugCode(name: string): string {
    const base = this.searchFolded(name).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const suffix = Date.now().toString(36).slice(-5);
    return `${base.substring(0, 90)}-${suffix}`;
  }
}
