import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { buildDishSearchText } from '../src/dishes/services/dish-command.service';

dotenv.config({ path: '.env.local' });

const pool = new (pg.Pool)({
  connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('Starting backfill for dish search_text...');
  const dishes = await (prisma as any).dish.findMany({
    select: {
      id: true,
      name: true,
      alternateNames: true,
      searchText: true,
      categories: { select: { category: { select: { name: true } } } },
      region: { select: { name: true } },
      dishIngredients: {
        select: {
          parsedName: true,
          ingredient: { select: { name: true, synonyms: true } },
        },
        take: 10,
      },
    },
  });

  console.log(`Found ${dishes.length} dishes to evaluate.`);
  let updatedCount = 0;

  for (const dish of dishes) {
    const categoryNames = dish.categories
      .map((c: any) => c.category?.name)
      .filter(Boolean);
    const regionName = dish.region?.name;
    const ingredientNames = dish.dishIngredients
      .map((di: any) => di.ingredient?.name || di.parsedName)
      .filter(Boolean);

    const newSearchText = buildDishSearchText(dish.name, dish.alternateNames, {
      categoryNames,
      regionName,
      ingredientNames,
    });

    if (newSearchText !== dish.searchText) {
      await (prisma as any).dish.update({
        where: { id: dish.id },
        data: { searchText: newSearchText },
      });
      updatedCount++;
    }
  }

  console.log(`Successfully updated ${updatedCount} dishes with enriched search_text.`);
}

main()
  .catch((e) => {
    console.error('Backfill error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await (prisma as any).$disconnect();
    await pool.end();
  });
