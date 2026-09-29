/**
 * food-scan-alternate-name-suggestions.ts
 *
 * Analyzes confirmed food_scan_events to identify recognized names that users
 * consistently mapped to a specific dish, but which are not yet in the dish's
 * name or alternateNames.
 *
 * Usage:
 *   npx ts-node scripts/food-scan-alternate-name-suggestions.ts [--min=3] [--apply]
 */

import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new pg.Pool({
  connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

interface SuggestionRow {
  recognized_name: string;
  chosen_dish_id: string;
  dish_name: string;
  alternate_names: string[];
  occurrences: number;
}

async function main() {
  const args = process.argv.slice(2);
  const minArg = args.find((a) => a.startsWith('--min='));
  const minOccurrences = minArg ? parseInt(minArg.split('=')[1], 10) : 3;
  const shouldApply = args.includes('--apply');

  console.log(`[FoodScan Suggestions] Scanning food_scan_events (min occurrences: ${minOccurrences})...`);

  const suggestions = await prisma.$queryRaw<SuggestionRow[]>(Prisma.sql`
    SELECT
      fse.extraction->>'primaryName' AS recognized_name,
      fse.chosen_dish_id::text,
      d.name AS dish_name,
      d.alternate_names,
      COUNT(*)::int AS occurrences
    FROM food_scan_events fse
    JOIN dishes d ON d.id = fse.chosen_dish_id
    WHERE fse.chosen_dish_id IS NOT NULL
      AND fse.correct = true
      AND fse.extraction->>'primaryName' IS NOT NULL
      AND fse.extraction->>'primaryName' != d.name
      AND NOT (fse.extraction->>'primaryName' = ANY(d.alternate_names))
    GROUP BY fse.extraction->>'primaryName', fse.chosen_dish_id, d.name, d.alternate_names
    HAVING COUNT(*) >= ${minOccurrences}
    ORDER BY occurrences DESC
  `);

  if (!suggestions.length) {
    console.log(`[FoodScan Suggestions] No candidate suggestions found with >= ${minOccurrences} occurrences.`);
    return;
  }

  console.log(`\nFound ${suggestions.length} suggested alternate names:`);
  console.log('='.repeat(80));

  for (const row of suggestions) {
    console.log(`\nDish: "${row.dish_name}" (ID: ${row.chosen_dish_id})`);
    console.log(`  Suggested alias: "${row.recognized_name}"`);
    console.log(`  Confirmed by users: ${row.occurrences} times`);
    console.log(`  Current aliases: [${(row.alternate_names || []).join(', ')}]`);

    if (shouldApply) {
      const updatedAliases = Array.from(
        new Set([...(row.alternate_names || []), row.recognized_name]),
      );
      await prisma.dish.update({
        where: { id: row.chosen_dish_id },
        data: { alternateNames: updatedAliases },
      });
      console.log(`  -> APPLIED: Added "${row.recognized_name}" to dish alternateNames.`);
    } else {
      console.log(
        `  -> SQL: UPDATE dishes SET alternate_names = array_append(alternate_names, '${row.recognized_name.replace(/'/g, "''")}') WHERE id = '${row.chosen_dish_id}';`,
      );
    }
  }

  console.log('\n' + '='.repeat(80));
  if (!shouldApply) {
    console.log('Tip: Run with --apply to automatically add these aliases to dishes.');
  }
}

main()
  .catch((e) => {
    console.error('Error running suggestions script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
