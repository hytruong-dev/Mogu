import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ChannelHit {
  dishId: string;
  rank: number;
  score: number;
}

export interface FusedCandidate {
  dishId: string;
  rrfScore: number;
  rrfNorm: number;
  channelConsensus: number;
  matchSource: 'PHASH' | 'RRF' | 'LEXICAL';
  lexicalScore?: number;
  textSim?: number;
  imageSim?: number;
}

const RRF_K = 60;
const WEIGHT_LEXICAL = 1.0;
const WEIGHT_TEXT = 0.8;
const WEIGHT_IMAGE = 1.2;
const MAX_RRF =
  WEIGHT_LEXICAL / (RRF_K + 1) +
  WEIGHT_TEXT / (RRF_K + 1) +
  WEIGHT_IMAGE / (RRF_K + 1);

@Injectable()
export class FoodScanRetrievalService {
  private readonly logger = new Logger(FoodScanRetrievalService.name);

  constructor(private readonly prisma: PrismaService) {}

  async searchPHash(pHash: string): Promise<string | null> {
    if (!pHash) return null;
    try {
      const rows = await this.prisma.db.$queryRaw<{ chosen_dish_id: string }[]>(
        Prisma.sql`
          SELECT e.chosen_dish_id
          FROM food_scan_events e
          JOIN dishes d ON d.id = e.chosen_dish_id
          WHERE e.image_phash = ${pHash}
            AND e.chosen_dish_id IS NOT NULL
            AND (e.correct IS TRUE OR e.correct IS NULL)
            AND d.status = 'PUBLISHED' AND d.deleted_at IS NULL
          ORDER BY e.confirmed_at DESC NULLS LAST, e.created_at DESC
          LIMIT 1
        `,
      );
      return rows[0]?.chosen_dish_id ?? null;
    } catch (e) {
      this.logger.warn(`pHash search error: ${e}`);
      return null;
    }
  }

  async searchLexical(
    terms: string[],
    primaryTerm?: string,
  ): Promise<ChannelHit[]> {
    if (!terms.length) return [];
    const primary = primaryTerm || terms[0] || '';
    try {
      const rows = await this.prisma.db.$queryRaw<{ id: string; score: number }[]>(
        Prisma.sql`
          WITH terms AS (SELECT unnest(ARRAY[${Prisma.join(terms)}]::text[]) AS term),
          matched AS (
            SELECT d.id,
              d.food_scan_name_folded,
              MAX(greatest(
                CASE WHEN d.food_scan_name_folded = t.term THEN 1.0 ELSE 0.0 END,
                similarity(d.food_scan_name_folded, t.term),
                similarity(d.food_scan_search_folded, t.term) * 0.9,
                word_similarity(t.term, d.food_scan_name_folded) * 0.9,
                word_similarity(d.food_scan_name_folded, t.term) * 0.9,
                word_similarity(t.term, d.food_scan_search_folded) * 0.8,
                CASE WHEN d.food_scan_name_folded ILIKE ('%' || t.term || '%') OR t.term ILIKE ('%' || d.food_scan_name_folded || '%') THEN 0.85 ELSE 0.0 END
              )) AS score
            FROM dishes d
            JOIN terms t ON (
              d.food_scan_name_folded = t.term
              OR d.food_scan_name_folded % t.term
              OR d.food_scan_search_folded % t.term
              OR d.food_scan_name_folded ILIKE ('%' || t.term || '%')
              OR t.term ILIKE ('%' || d.food_scan_name_folded || '%')
              OR word_similarity(t.term, d.food_scan_name_folded) >= 0.25
              OR word_similarity(d.food_scan_name_folded, t.term) >= 0.25
              OR word_similarity(t.term, d.food_scan_search_folded) >= 0.25
            )
            WHERE d.status = 'PUBLISHED' AND d.deleted_at IS NULL
            GROUP BY d.id, d.food_scan_name_folded
          )
          SELECT id, score::float8
          FROM matched
          ORDER BY score DESC, similarity(food_scan_name_folded, ${primary}) DESC
          LIMIT 25
        `,
      );
      return rows.map((r: any, i) => ({
        dishId: r.id,
        rank: i + 1,
        score: r.score ?? r.primaryScore ?? 0.8,
      }));
    } catch (e) {
      this.logger.warn(`Lexical search error: ${e}`);
      return [];
    }
  }

  async searchDenseText(queryVec: number[]): Promise<ChannelHit[]> {
    if (!queryVec || queryVec.length !== 512) return [];
    try {
      const vecString = `[${queryVec.join(',')}]`;
      const rows = await this.prisma.db.$queryRaw<{ id: string; dist: number }[]>(
        Prisma.sql`
          SELECT d.id, (d.food_scan_text_embedding <=> ${vecString}::vector)::float8 AS dist
          FROM dishes d
          WHERE d.status = 'PUBLISHED' AND d.deleted_at IS NULL
            AND d.food_scan_text_embedding IS NOT NULL
          ORDER BY d.food_scan_text_embedding <=> ${vecString}::vector ASC
          LIMIT 25
        `,
      );
      return rows.map((r, i) => ({
        dishId: r.id,
        rank: i + 1,
        score: Math.max(0, 1 - r.dist),
      }));
    } catch (e) {
      this.logger.warn(`Dense text search error: ${e}`);
      return [];
    }
  }

  async searchDenseImage(queryVec: number[]): Promise<ChannelHit[]> {
    if (!queryVec || queryVec.length !== 512) return [];
    try {
      const vecString = `[${queryVec.join(',')}]`;
      const rows = await this.prisma.db.$queryRaw<{ dish_id: string; dist: number }[]>(
        Prisma.sql`
          SELECT m.dish_id, (m.image_embedding <=> ${vecString}::vector)::float8 AS dist
          FROM dish_media m
          JOIN dishes d ON d.id = m.dish_id
          WHERE d.status = 'PUBLISHED' AND d.deleted_at IS NULL
            AND m.type = 'IMAGE'
            AND m.moderation_status = 'APPROVED'
            AND m.image_embedding IS NOT NULL
          ORDER BY m.image_embedding <=> ${vecString}::vector ASC
          LIMIT 30
        `,
      );

      // Group by dish_id and take closest
      const seen = new Map<string, number>();
      for (const r of rows) {
        if (!seen.has(r.dish_id)) {
          seen.set(r.dish_id, Math.max(0, 1 - r.dist));
        }
      }

      return Array.from(seen.entries())
        .slice(0, 25)
        .map(([dishId, score], i) => ({ dishId, rank: i + 1, score }));
    } catch (e) {
      this.logger.warn(`Dense image search error: ${e}`);
      return [];
    }
  }

  fuse(
    lexicalHits: ChannelHit[],
    textHits: ChannelHit[],
    imageHits: ChannelHit[],
    pHashDishId: string | null,
    limit = 8,
  ): FusedCandidate[] {
    const scores = new Map<
      string,
      {
        rrf: number;
        channels: Set<string>;
        lexicalScore?: number;
        textSim?: number;
        imageSim?: number;
        isPhash?: boolean;
      }
    >();

    const addChannel = (
      hits: ChannelHit[],
      channelName: string,
      weight: number,
      scoreField: 'lexicalScore' | 'textSim' | 'imageSim',
    ) => {
      for (const hit of hits) {
        let entry = scores.get(hit.dishId);
        if (!entry) {
          entry = { rrf: 0, channels: new Set() };
          scores.set(hit.dishId, entry);
        }
        entry.rrf += weight / (RRF_K + hit.rank);
        if (channelName === 'lexical' && hit.score >= 0.95) {
          entry.rrf += 0.5; // Exact lexical match boost
        }
        entry.channels.add(channelName);
        entry[scoreField] = hit.score;
      }
    };

    addChannel(lexicalHits, 'lexical', WEIGHT_LEXICAL, 'lexicalScore');
    addChannel(textHits, 'text', WEIGHT_TEXT, 'textSim');
    addChannel(imageHits, 'image', WEIGHT_IMAGE, 'imageSim');

    if (pHashDishId) {
      let entry = scores.get(pHashDishId);
      if (!entry) {
        entry = { rrf: 0, channels: new Set() };
        scores.set(pHashDishId, entry);
      }
      entry.rrf += 2.0; // Large boost for pHash match
      entry.channels.add('phash');
      entry.isPhash = true;
    }

    const sorted = Array.from(scores.entries()).sort(
      (a, b) => b[1].rrf - a[1].rrf,
    );

    return sorted.slice(0, limit).map(([dishId, data]) => {
      const channelMax = Math.max(
        data.lexicalScore ?? 0,
        data.textSim ?? 0,
        data.imageSim ?? 0,
      );
      const rrfNorm = Math.min(1, data.rrf / MAX_RRF);
      const effectiveNorm = data.isPhash
        ? 1.0
        : Math.min(1, Math.max(rrfNorm, channelMax));

      return {
        dishId,
        rrfScore: data.rrf,
        rrfNorm: effectiveNorm,
        channelConsensus: data.channels.size,
        matchSource: data.isPhash
          ? 'PHASH'
          : data.channels.size > 1
            ? 'RRF'
            : 'LEXICAL',
        lexicalScore: data.lexicalScore,
        textSim: data.textSim,
        imageSim: data.imageSim,
      };
    });
  }

  shouldSkipRerank(
    candidates: FusedCandidate[],
    hasImageEmbedding: boolean,
  ): boolean {
    const top = candidates[0];
    if (!top) return false;
    if (top.matchSource === 'PHASH') return true;

    const second = candidates[1];
    const margin = top.rrfScore - (second?.rrfScore ?? 0);

    // Only skip when the *name* strongly matches (lexical >= 0.9) and at least one
    // other channel agrees. Image + text-embedding consensus alone is not enough:
    // for dishes missing from the DB, those channels agree on the most *similar*
    // dish, not the correct one — the closed-set rerank must get to say "none".
    if (
      hasImageEmbedding &&
      (top.lexicalScore ?? 0) >= 0.9 &&
      top.channelConsensus >= 2 &&
      top.rrfNorm >= 0.70 &&
      margin >= 0.012
    ) {
      return true;
    }

    return false;
  }
}
