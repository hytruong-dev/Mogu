/**
 * benchmark-food-scan.ts
 *
 * Compares the baseline (single-name lexical match) against the new
 * Retrieve -> Rerank -> Confirm architecture across the 40-item eval dataset.
 *
 * Usage:
 *   npx ts-node scripts/benchmark-food-scan.ts
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '@prisma/client';
import dotenv from 'dotenv';
import {
  foldFoodScanName,
  selectFoodScanStatus,
  stripFoodScanStopWords,
} from '../src/food-scan/food-scan-matcher.service';
import type { FoodScanCandidate, FoodScanExtraction } from '../src/food-scan/dto/food-scan.dto';
import { FoodScanRetrievalService } from '../src/food-scan/food-scan-retrieval.service';
import { FoodScanEmbeddingService } from '../src/food-scan/food-scan-embedding.service';
import { ConfigService } from '@nestjs/config';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

interface EvalItem {
  id: string;
  /** null = dish intentionally NOT in the DB (must be reported as UNKNOWN_DISH). */
  expectedDishId: string | null;
  expectedDishName: string;
  description: string;
  extraction: {
    isFood: boolean;
    primaryName: string;
    alternateNames: string[];
    guesses: { nameVi: string; nameEn: string | null; confidence: number }[];
    category: string;
    cuisine: string;
    visibleIngredients: string[];
    quality: string;
  };
}

async function runBaseline(
  item: EvalItem,
): Promise<{ top1Match: boolean; top3Match: boolean; rank: number; latencyMs: number }> {
  const t0 = Date.now();
  const folded = foldFoodScanName(item.extraction.primaryName);

  // Baseline query: exact or trigram similarity on food_scan_name_folded only
  const rows = await (prisma as any).$queryRaw(Prisma.sql`
    SELECT id, similarity(food_scan_name_folded, ${folded}) AS sim
    FROM dishes
    WHERE status = 'PUBLISHED' AND deleted_at IS NULL
      AND (
        food_scan_name_folded = ${folded}
        OR similarity(food_scan_name_folded, ${folded}) >= 0.3
      )
    ORDER BY sim DESC
    LIMIT 5
  `);

  const latencyMs = Date.now() - t0;
  const candidateIds = (rows as any[]).map((r) => r.id);
  const foundIdx = item.expectedDishId ? candidateIds.indexOf(item.expectedDishId) : -1;

  return {
    top1Match: foundIdx === 0,
    top3Match: foundIdx >= 0 && foundIdx < 3,
    rank: foundIdx >= 0 ? foundIdx + 1 : 0,
    latencyMs,
  };
}

async function runNewPipeline(
  item: EvalItem,
  retrieval: FoodScanRetrievalService,
  embedding: FoodScanEmbeddingService,
): Promise<{
  top1Match: boolean;
  top3Match: boolean;
  rank: number;
  latencyMs: number;
  source: string;
  /** Pipeline presents a dish as the answer (MATCHED / SUGGESTIONS). */
  accepted: boolean;
  status: string;
}> {
  const t0 = Date.now();

  // Multi-term extraction
  const guessTerms = (item.extraction.guesses || []).flatMap((g) => [
    foldFoodScanName(g.nameVi),
    stripFoodScanStopWords(foldFoodScanName(g.nameVi)),
    g.nameEn ? foldFoodScanName(g.nameEn) : '',
  ]).filter(Boolean);

  const primary = foldFoodScanName(item.extraction.primaryName);
  const primaryClean = stripFoodScanStopWords(primary);
  const terms = Array.from(new Set([primary, primaryClean, ...guessTerms].filter(Boolean)));

  // 1. Lexical channel
  const lexicalHits = await retrieval.searchLexical(terms, primary);

  // 2. Dense text embedding channel
  const textQuery = item.extraction.primaryName || item.extraction.guesses[0]?.nameVi || '';
  const textVec = await embedding.embedText(textQuery);
  const textHits = textVec ? await retrieval.searchDenseText(textVec) : [];

  // 3. RRF Fusion
  const fused = retrieval.fuse(lexicalHits, textHits, [], null, 8);

  const latencyMs = Date.now() - t0;
  const candidateIds = fused.map((f) => f.dishId);
  const foundIdx = item.expectedDishId ? candidateIds.indexOf(item.expectedDishId) : -1;

  // Status decision without a photo: the rerank (vision) step cannot run offline, so this
  // measures the conservative "rerank unavailable" gate (lexical evidence required).
  const candidates = fused.map(
    (f) => ({ dishId: f.dishId, score: 0.75 * f.rrfNorm + 0.125 }) as unknown as FoodScanCandidate,
  );
  const status = selectFoodScanStatus(item.extraction as unknown as FoodScanExtraction, candidates, {
    rerankRan: false,
    rerankBestIndex: null,
    topIsPhash: fused[0]?.matchSource === 'PHASH',
    topLexicalScore: fused[0]?.lexicalScore ?? 0,
  });

  return {
    top1Match: foundIdx === 0,
    top3Match: foundIdx >= 0 && foundIdx < 3,
    rank: foundIdx >= 0 ? foundIdx + 1 : 0,
    latencyMs,
    source: fused[0]?.matchSource ?? 'NONE',
    accepted: status === 'MATCHED' || status === 'SUGGESTIONS',
    status,
  };
}

async function main() {
  const datasetPath = path.resolve(__dirname, '../test/food-scan-eval/dataset.json');
  const dataset: EvalItem[] = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

  console.log('='.repeat(80));
  console.log(`Food Scan Architecture Benchmark`);
  console.log(`Evaluating ${dataset.length} test samples across published dishes in DB...`);
  console.log('='.repeat(80));

  const config = new ConfigService({});
  const retrieval = new FoodScanRetrievalService({ db: prisma } as any);
  const embedding = new FoodScanEmbeddingService(config);

  let baselineTop1 = 0;
  let baselineTop3 = 0;
  let baselineMjrSum = 0;
  let baselineLatencies: number[] = [];

  let newTop1 = 0;
  let newTop3 = 0;
  let newMjrSum = 0;
  let newLatencies: number[] = [];

  const known = dataset.filter((d) => d.expectedDishId);
  const unknown = dataset.filter((d) => !d.expectedDishId);
  let knownAccepted = 0;
  let unknownFalseAccept = 0;
  let unknownFlagged = 0;

  for (let i = 0; i < unknown.length; i++) {
    const item = unknown[i];
    const nRes = await runNewPipeline(item, retrieval, embedding);
    if (nRes.accepted) unknownFalseAccept++;
    else unknownFlagged++;
    console.log(
      `[unknown ${i + 1}/${unknown.length}] ${item.expectedDishName.padEnd(26)} | status: ${nRes.status.padEnd(12)} | ${nRes.accepted ? '✗ FALSE ACCEPT' : '✓ flagged'} (${nRes.latencyMs}ms)`,
    );
  }

  for (let i = 0; i < known.length; i++) {
    const item = known[i];
    const bRes = await runBaseline(item);
    if (bRes.top1Match) baselineTop1++;
    if (bRes.top3Match) baselineTop3++;
    if (bRes.rank > 0) baselineMjrSum += 1 / bRes.rank;
    baselineLatencies.push(bRes.latencyMs);

    const nRes = await runNewPipeline(item, retrieval, embedding);
    if (nRes.top1Match) newTop1++;
    if (nRes.top3Match) newTop3++;
    if (nRes.rank > 0) newMjrSum += 1 / nRes.rank;
    if (nRes.top1Match && nRes.accepted) knownAccepted++;
    newLatencies.push(nRes.latencyMs);

    const statusTag = nRes.top1Match
      ? '✓ TOP-1'
      : nRes.top3Match
        ? '✓ TOP-3'
        : '✗ MISS';

    console.log(
      `[${i + 1}/${known.length}] ${item.expectedDishName.padEnd(26)} | Baseline Rank: ${bRes.rank || '-'} | New Rank: ${nRes.rank || '-'} | ${statusTag} (${nRes.latencyMs}ms)`,
    );
  }

  const n = Math.max(known.length, 1);
  const bTop1Pct = ((baselineTop1 / n) * 100).toFixed(1);
  const bTop3Pct = ((baselineTop3 / n) * 100).toFixed(1);
  const bMrr = (baselineMjrSum / n).toFixed(3);
  const bAvgLat = Math.round(baselineLatencies.reduce((a, b) => a + b, 0) / n);

  const nTop1Pct = ((newTop1 / n) * 100).toFixed(1);
  const nTop3Pct = ((newTop3 / n) * 100).toFixed(1);
  const nMrr = (newMjrSum / n).toFixed(3);
  const nAvgLat = Math.round(newLatencies.reduce((a, b) => a + b, 0) / n);

  console.log('\n' + '='.repeat(80));
  console.log('BENCHMARK EVALUATION RESULTS');
  console.log('='.repeat(80));
  console.log(
    `Metric                | Baseline (Old)      | New Pipeline (Retrieve->RRF) | Target`,
  );
  console.log('-'.repeat(80));
  console.log(
    `Top-1 Accuracy        | ${baselineTop1}/${n} (${bTop1Pct}%)`.padEnd(22) +
      `| ${newTop1}/${n} (${nTop1Pct}%)`.padEnd(30) +
      `| >= 80%`,
  );
  console.log(
    `Top-3 Accuracy        | ${baselineTop3}/${n} (${bTop3Pct}%)`.padEnd(22) +
      `| ${newTop3}/${n} (${nTop3Pct}%)`.padEnd(30) +
      `| >= 92%`,
  );
  console.log(
    `Mean Recip. Rank (MRR)| ${bMrr}`.padEnd(22) +
      `| ${nMrr}`.padEnd(30) +
      `| > 0.85`,
  );
  console.log(
    `Avg Retrieval Latency | ${bAvgLat}ms`.padEnd(22) +
      `| ${nAvgLat}ms`.padEnd(30) +
      `| < 500ms`,
  );
  const u = Math.max(unknown.length, 1);
  console.log('-'.repeat(80));
  console.log(
    `Known: correct+accepted | ${knownAccepted}/${known.length} (${((knownAccepted / n) * 100).toFixed(1)}%)`,
  );
  console.log(
    `Unknown: false accept   | ${unknownFalseAccept}/${unknown.length} (${((unknownFalseAccept / u) * 100).toFixed(1)}%) | target <= 10%`,
  );
  console.log(
    `Unknown: flagged "chưa có" | ${unknownFlagged}/${unknown.length} (${((unknownFlagged / u) * 100).toFixed(1)}%)`,
  );
  console.log(
    'Note: offline run has no photo, so rerank is treated as unavailable (strictest gate).',
  );
  console.log('='.repeat(80));
}

main()
  .catch((e) => {
    console.error('Benchmark failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
