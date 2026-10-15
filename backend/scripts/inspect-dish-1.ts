import * as path from 'path';
import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  const dish = await prisma.dish.findUnique({
    where: { id: '6dbcf9af-4282-463c-bd27-471b0867ab73' },
    include: {
      mealTypes: { include: { mealTypeTag: true } },
      categories: { include: { category: true } },
      nutrition: true,
      dishIngredients: { include: { ingredient: true } },
      recipeSteps: true,
      media: true,
    }
  });

  console.log('Dish name:', dish?.name);
  console.log('Servings:', dish?.servings?.toString());
  console.log('Meal types:', dish?.mealTypes.map((m: any) => m.mealTypeTag.name));
  console.log('Categories:', dish?.categories.map((c: any) => c.category.name));
  console.log('Nutrition calories:', dish?.nutrition?.calories);
  console.log('Ingredients count:', dish?.dishIngredients.length);
  console.log('Recipe steps count:', dish?.recipeSteps.length);
  console.log('Media count:', dish?.media.length);

  await prisma.$disconnect();
  await pool.end();
}
main().catch(console.error);
