import { Injectable, Logger } from '@nestjs/common';
import { PlaceDishMatchStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { foldFoodScanName } from '../../food-scan/food-scan-matcher.service';
import type { PlaceMenuItem } from './place-input';

/**
 * Trigram extraction compatible with PostgreSQL pg_trgm:
 * each alphanumeric word is padded with 2 leading spaces + 1 trailing space.
 */
export function trigrams(folded: string): Set<string> {
  const out = new Set<string>();
  for (const word of folded.split(/[^a-z0-9]+/).filter(Boolean)) {
    const padded = `  ${word} `;
    for (let i = 0; i + 3 <= padded.length; i++) out.add(padded.slice(i, i + 3));
  }
  return out;
}

/** Same formula as pg_trgm `similarity()`: shared / (|a| + |b| - shared). */
export function trigramSimilarity(a: string, b: string): number {
  const ta = trigrams(foldFoodScanName(a));
  const tb = trigrams(foldFoodScanName(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared);
}

/** True when `needle` appears as a whole-word sequence inside `haystack` (both folded). */
export function containsPhrase(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return ` ${haystack} `.includes(` ${needle} `);
}

export const MATCH_THRESHOLD_LIKELY = 0.6;
export const MATCH_THRESHOLD_CONFIRMED = 0.85;
/** Folded dish names shorter than this are too generic for phrase containment ("com", "bun"). */
const MIN_PHRASE_LEN = 4;

/** Generic menu words removed before comparing (portion sizes, toppings markers...). */
const MENU_NOISE = new Set([
  'mon', 'suat', 'phan', 'to', 'bat', 'dia', 'ly', 'hop', 'combo', 'size', 'nho', 'vua', 'lon',
  'dac', 'biet', 'thuong', 'them', 'khong', 'co', 'va', 'kem', 'new', 'best', 'seller', 'hot',
]);

export function cleanMenuName(name: string): string {
  return foldFoodScanName(name)
    .replace(/\b\d+[a-z]*\b/g, ' ') // "500ml", "2", "1kg"
    .split(' ')
    .filter((w) => w && !MENU_NOISE.has(w))
    .join(' ')
    .trim();
}

export interface CatalogDish {
  id: string;
  name: string;
  /** Folded names: canonical + alternate names. */
  names: string[];
}

export interface DishMatch {
  dishId: string;
  dishName: string;
  status: PlaceDishMatchStatus;
  score: number;
  sourceItemName: string | null;
  priceVnd: number | null;
}

type Candidate = { dishIdx: number; nameIdx: number; score: number; contains: boolean };

/**
 * In-memory matcher (pg_trgm-compatible) — faster than one SQL round-trip per
 * menu item, and deterministic for unit tests.
 */
export class DishCatalogMatcher {
  private readonly entries: { dishIdx: number; folded: string; grams: Set<string> }[] = [];
  private readonly index = new Map<string, number[]>();

  constructor(private readonly dishes: CatalogDish[]) {
    dishes.forEach((dish, dishIdx) => {
      for (const n of dish.names) {
        const folded = foldFoodScanName(n);
        if (!folded) continue;
        const entryIdx = this.entries.length;
        const grams = trigrams(folded);
        this.entries.push({ dishIdx, folded, grams });
        for (const g of grams) {
          const list = this.index.get(g);
          if (list) list.push(entryIdx);
          else this.index.set(g, [entryIdx]);
        }
      }
    });
  }

  get size() {
    return this.dishes.length;
  }

  /** Best dish candidates for a single text (menu item or place name). */
  matchText(text: string): Candidate[] {
    const folded = cleanMenuName(text);
    if (!folded) return [];
    const q = trigrams(folded);
    const shared = new Map<number, number>();
    for (const g of q) {
      for (const entryIdx of this.index.get(g) ?? []) {
        shared.set(entryIdx, (shared.get(entryIdx) ?? 0) + 1);
      }
    }
    const best = new Map<number, Candidate>();
    for (const [entryIdx, s] of shared) {
      const e = this.entries[entryIdx];
      const sim = s / (q.size + e.grams.size - s);
      const contains = e.folded.length >= MIN_PHRASE_LEN && containsPhrase(folded, e.folded);
      const score = contains ? Math.max(sim, MATCH_THRESHOLD_CONFIRMED) : sim;
      if (score < MATCH_THRESHOLD_LIKELY) continue;
      const prev = best.get(e.dishIdx);
      if (!prev || score > prev.score || (contains && !prev.contains)) {
        best.set(e.dishIdx, { dishIdx: e.dishIdx, nameIdx: entryIdx, score, contains });
      }
    }
    const list = [...best.values()];
    // When several dish names are contained ("pho" & "pho bo"), keep the most specific one.
    const contained = list.filter((c) => c.contains);
    if (contained.length > 1) {
      const longest = Math.max(...contained.map((c) => this.entries[c.nameIdx].folded.length));
      return list.filter(
        (c) => !c.contains || this.entries[c.nameIdx].folded.length === longest,
      );
    }
    return list;
  }

  /**
   * Match a place (name + menu) to catalog dishes.
   * - Menu item containing a full dish name or similarity >= 0.85 -> CONFIRMED
   * - similarity >= 0.6 -> LIKELY
   * - Place-name-only matches are capped at LIKELY.
   */
  matchPlace(placeName: string, menu: PlaceMenuItem[] = []): DishMatch[] {
    const byDish = new Map<string, DishMatch>();
    const rank = (s: PlaceDishMatchStatus) => (s === 'CONFIRMED' ? 2 : s === 'LIKELY' ? 1 : 0);
    const upsert = (m: DishMatch) => {
      const prev = byDish.get(m.dishId);
      if (!prev) return byDish.set(m.dishId, m);
      const better =
        rank(m.status) > rank(prev.status) ||
        (rank(m.status) === rank(prev.status) && m.score > prev.score);
      const merged = better ? { ...m } : { ...prev };
      // Keep the cheapest observed price for the dish
      const prices = [prev.priceVnd, m.priceVnd].filter((p): p is number => typeof p === 'number' && p > 0);
      merged.priceVnd = prices.length ? Math.min(...prices) : null;
      byDish.set(m.dishId, merged);
    };

    for (const item of menu) {
      if (!item?.name) continue;
      for (const c of this.matchText(item.name)) {
        const dish = this.dishes[c.dishIdx];
        upsert({
          dishId: dish.id,
          dishName: dish.name,
          status: c.score >= MATCH_THRESHOLD_CONFIRMED ? 'CONFIRMED' : 'LIKELY',
          score: round3(c.score),
          sourceItemName: item.name.slice(0, 300),
          priceVnd: typeof item.priceVnd === 'number' && item.priceVnd > 0 ? Math.round(item.priceVnd) : null,
        });
      }
    }

    for (const c of this.matchText(placeName)) {
      const dish = this.dishes[c.dishIdx];
      upsert({
        dishId: dish.id,
        dishName: dish.name,
        status: 'LIKELY',
        score: round3(Math.min(c.score, MATCH_THRESHOLD_CONFIRMED - 0.001)),
        sourceItemName: null,
        priceVnd: null,
      });
    }

    return [...byDish.values()].sort((a, b) => b.score - a.score);
  }
}

function round3(v: number) {
  return Math.round(v * 1000) / 1000;
}

@Injectable()
export class DishMatcherService {
  private readonly logger = new Logger(DishMatcherService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Load PUBLISHED dishes (canonical + alternate names) into an in-memory matcher. */
  async loadCatalog(): Promise<DishCatalogMatcher> {
    const rows = await this.prisma.db.dish.findMany({
      where: { status: 'PUBLISHED' },
      select: { id: true, name: true, alternateNames: true, foodScanNameFolded: true },
    });
    const dishes: CatalogDish[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      names: [r.name, r.foodScanNameFolded, ...(r.alternateNames ?? [])].filter(Boolean),
    }));
    this.logger.log(`Dish catalog loaded: ${dishes.length} published dishes`);
    return new DishCatalogMatcher(dishes);
  }
}
