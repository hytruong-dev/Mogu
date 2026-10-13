/**
 * Re-run dish matching on stored place menus (`places.source_meta.menu`) — use after
 * adding new dishes to the catalog. Admin decisions (CONFIRMED/REJECTED) are kept.
 *
 *   npx ts-node -r tsconfig-paths/register scripts/rematch-place-dishes.ts [--provider SHOPEEFOOD] [--dry-run]
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { PrismaService } from '../src/prisma/prisma.service';
import { DishMatcherService } from '../src/places/ingest/dish-matcher.service';
import { PlaceIngestService } from '../src/places/ingest/place-ingest.service';

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const pIdx = argv.indexOf('--provider');
  const provider = pIdx >= 0 ? argv[pIdx + 1]?.toUpperCase() : undefined;

  const prisma = new PrismaService();
  await prisma.onModuleInit();
  try {
    const matcher = await new DishMatcherService(prisma).loadCatalog();
    const report = await new PlaceIngestService(prisma).rematchAll(matcher, { provider, dryRun });
    console.log('\n===== Rematch report =====');
    if (dryRun) {
      for (const p of report.dryRunPreview.slice(0, 50)) {
        console.log(`  • ${p.name} -> ${p.matches.map((m) => `${m.dishName} [${m.status} ${m.score}]`).join(', ')}`);
      }
    } else {
      console.log(`Places relinked: ${report.placesUpdated}`);
      console.log(`Dish links:      ${report.dishLinksUpserted}`);
    }
    console.log(`Unmatched:       ${report.unmatched.length}`);
  } finally {
    await prisma.onModuleDestroy();
  }
}

main().catch((e) => {
  console.error('rematch-place-dishes failed:', e);
  process.exit(1);
});
