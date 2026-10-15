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
  try {
    const dish = await prisma.dish.findUnique({
      where: { id: '80d01f3c-326e-487e-89f1-9370b5f81f97' },
      include: {
        nutrition: true,
        dishIngredients: {
          include: { ingredient: { select: { id: true, name: true } } },
        },
      },
    });
    console.log('Dish created:', {
      name: dish?.name,
      servings: dish?.servings,
      ingredientsCount: dish?.dishIngredients.length,
      unlinkedCount: dish?.dishIngredients.filter((i) => !i.ingredientId).length,
      ingredients: dish?.dishIngredients.map((i) => ({
        raw: i.rawText,
        matched: i.ingredient?.name ?? 'UNLINKED',
        qty: i.quantity,
        unit: i.unit,
        weightG: i.normalizedWeightG,
      })),
      nutrition: dish?.nutrition,
    });
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
main().catch(console.error);
