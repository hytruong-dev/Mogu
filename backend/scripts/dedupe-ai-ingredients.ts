/**
 * Báo cáo nguyên liệu PENDING_REVIEW (chủ yếu do AI import tạo) có khả năng
 * trùng với nguyên liệu đã có trong kho. KHÔNG tự merge; xuất bảng để admin duyệt.
 *
 *   npx ts-node -r tsconfig-paths/register scripts/dedupe-ai-ingredients.ts
 *   npx ts-node -r tsconfig-paths/register scripts/dedupe-ai-ingredients.ts --active   # quét cả ACTIVE↔ACTIVE (bản mới gộp vào bản cũ)
 *   npx ts-node -r tsconfig-paths/register scripts/dedupe-ai-ingredients.ts --ai       # thêm bước AI phân xử
 *   npx ts-node -r tsconfig-paths/register scripts/dedupe-ai-ingredients.ts --apply    # merge các cặp chắc chắn (L1 / AI ≥ 90)
 *   npx ts-node -r tsconfig-paths/register scripts/dedupe-ai-ingredients.ts --json out.json
 */
import 'dotenv/config';
import { writeFileSync } from 'fs';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { IngredientStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { CatalogIngredientResolverService } from '../src/ingredients/ingredient-resolver.service';
import { IngredientCatalogService } from '../src/ingredients/ingredient-catalog.service';
import { AiService } from '../src/ai-import/ai.service';

interface Suggestion {
  sourceId: string;
  sourceName: string;
  targetId: string;
  targetName: string;
  method: string;
  confidence: number;
  dishCount: number;
}

async function main() {
  const args = process.argv.slice(2);
  const useAi = args.includes('--ai');
  const apply = args.includes('--apply');
  const jsonIdx = args.indexOf('--json');
  const jsonPath = jsonIdx >= 0 ? args[jsonIdx + 1] : null;
  const logger = new Logger('DedupeIngredients');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });
  const prisma = app.get(PrismaService);
  const resolver = app.get(CatalogIngredientResolverService);
  const catalog = app.get(IngredientCatalogService);
  const ai = app.get(AiService);

  const includeActive = args.includes('--active');
  const pending = await prisma.db.ingredient.findMany({
    where: {
      status: includeActive
        ? { in: [IngredientStatus.PENDING_REVIEW, IngredientStatus.ACTIVE] }
        : IngredientStatus.PENDING_REVIEW,
    },
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
      createdVia: true,
      synonyms: true,
      _count: { select: { dishIngredients: true } },
    },
    // Mới hơn kiểm tra trước → khi 2 ACTIVE trùng nhau, bản mới hơn thành "nguồn".
    orderBy: { createdAt: 'desc' },
  });
  logger.log(
    `Đang kiểm tra ${pending.length} nguyên liệu ${includeActive ? 'PENDING_REVIEW + ACTIVE' : 'PENDING_REVIEW'}...`,
  );
  const createdAtById = new Map(
    pending.map((p) => [p.id, p.createdAt.getTime()]),
  );
  const alreadySource = new Set<string>();

  const suggestions: Suggestion[] = [];
  const undecided: Array<{
    ref: string;
    source: (typeof pending)[number];
    candidates: Array<{
      id: string;
      name: string;
      synonyms?: string[];
      score: number;
    }>;
  }> = [];

  // Resolve theo lô 50; loại chính nó khỏi tập so khớp qua excludeIds.
  for (let i = 0; i < pending.length; i += 50) {
    const chunk = pending.slice(i, i + 50);
    const res = await resolver.resolveExistingBatch(
      chunk.map((p) => ({
        clientRef: p.id,
        rawName: p.name,
        excludeIds: [p.id],
      })),
    );
    for (const p of chunk) {
      const hit = res.get(p.id);
      if (!hit || alreadySource.has(p.id)) continue;

      // Chỉ gộp vào ACTIVE; khi cả hai ACTIVE thì đích phải cũ hơn nguồn.
      const okTarget = (id: string, status: IngredientStatus) =>
        id !== p.id &&
        status === IngredientStatus.ACTIVE &&
        !alreadySource.has(id) &&
        (p.status !== IngredientStatus.ACTIVE ||
          (createdAtById.get(id) ?? 0) < (createdAtById.get(p.id) ?? Infinity));

      if (hit.ingredientId) {
        const target = await prisma.db.ingredient.findUnique({
          where: { id: hit.ingredientId },
          select: { id: true, name: true, status: true },
        });
        if (target && okTarget(target.id, target.status)) {
          suggestions.push({
            sourceId: p.id,
            sourceName: p.name,
            targetId: target.id,
            targetName: target.name,
            method: hit.outcome,
            confidence: hit.confidence ?? 95,
            dishCount: p._count.dishIngredients,
          });
          alreadySource.add(p.id);
          continue;
        }
      }
      const cands = hit.candidates.filter((c) => okTarget(c.id, c.status));
      if (cands.length) {
        undecided.push({ ref: p.id, source: p, candidates: cands });
      }
    }
  }

  if (useAi && undecided.length) {
    logger.log(
      `AI phân xử ${undecided.length} nguyên liệu có ứng viên gần giống...`,
    );
    for (let i = 0; i < undecided.length; i += 25) {
      const chunk = undecided.slice(i, i + 25);
      const decisions = await ai.adjudicateIngredientMatches({
        dishName: 'Kho nguyên liệu (dọn trùng)',
        allIngredientNames: chunk.map((u) => u.source.name),
        items: chunk.map((u) => ({
          ref: u.ref,
          name: u.source.name,
          candidates: u.candidates,
        })),
      });
      for (const d of decisions) {
        if (!d.matchId) continue;
        const u = chunk.find((x) => x.ref === d.ref)!;
        const target = u.candidates.find((c) => c.id === d.matchId)!;
        suggestions.push({
          sourceId: u.source.id,
          sourceName: u.source.name,
          targetId: target.id,
          targetName: target.name,
          method: 'AI',
          confidence: d.confidence,
          dishCount: u.source._count.dishIngredients,
        });
      }
    }
  } else {
    for (const u of undecided) {
      const top = u.candidates[0];
      suggestions.push({
        sourceId: u.source.id,
        sourceName: u.source.name,
        targetId: top.id,
        targetName: top.name,
        method: `CANDIDATE`,
        confidence: top.score,
        dishCount: u.source._count.dishIngredients,
      });
    }
  }

  suggestions.sort((a, b) => b.confidence - a.confidence);

  // In bảng.
  const pad = (s: string, n: number) =>
    s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n);
  console.log('');
  console.log(
    `${pad('NGUỒN (PENDING)', 28)} ${pad('→ ĐÍCH (ACTIVE)', 28)} ${pad('PHƯƠNG PHÁP', 20)} ${'TIN CẬY'.padEnd(8)} MÓN`,
  );
  console.log('-'.repeat(95));
  for (const s of suggestions) {
    console.log(
      `${pad(s.sourceName, 28)} ${pad(s.targetName, 28)} ${pad(s.method, 20)} ${String(s.confidence).padEnd(8)} ${s.dishCount}`,
    );
  }
  console.log('-'.repeat(95));
  console.log(`Tổng: ${suggestions.length} gợi ý / ${pending.length} PENDING`);

  if (jsonPath) {
    writeFileSync(jsonPath, JSON.stringify(suggestions, null, 2), 'utf8');
    logger.log(`Đã ghi ${jsonPath}`);
  }

  if (apply) {
    const sure = suggestions.filter(
      (s) =>
        s.method === 'EXISTING_EXACT' ||
        s.method === 'EXISTING_SYNONYM' ||
        s.method === 'EXISTING_NORMALIZED' ||
        (s.method === 'AI' && s.confidence >= 90),
    );
    logger.log(`Áp dụng merge cho ${sure.length} cặp chắc chắn...`);
    let ok = 0;
    for (const s of sure) {
      try {
        await catalog.mergeIngredient(s.sourceId, s.targetId);
        ok++;
      } catch (err) {
        logger.warn(
          `Merge "${s.sourceName}" → "${s.targetName}" thất bại: ${(err as Error).message}`,
        );
      }
    }
    logger.log(`Đã gộp ${ok}/${sure.length}.`);
  } else if (suggestions.length) {
    logger.log(
      'Chạy lại với --apply để gộp các cặp chắc chắn, hoặc duyệt thủ công trong Admin.',
    );
  }

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
