import * as path from 'path';
import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

async function getStats() {
  const pool = new pg.Pool({
    connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    const [
      dishes,
      dishIngredients,
      ingredients,
      recipeSteps,
      dishMedia,
      dishNutrition,
      randomCandidates,
      weeklySlots,
      savedDishes,
      placeDishes,
    ] = await Promise.all([
      prisma.dish.count(),
      prisma.dishIngredient.count(),
      prisma.ingredient.count(),
      prisma.recipeStep.count(),
      prisma.dishMedia.count(),
      prisma.dishNutrition.count(),
      prisma.randomCandidate.count(),
      prisma.weeklyPlanSlot.count(),
      prisma.savedDish.count(),
      prisma.placeDish.count(),
    ]);

    const [activeIngredients, pendingIngredients] = await Promise.all([
      prisma.ingredient.count({ where: { isActive: true } }),
      prisma.ingredient.count({ where: { isActive: false } }),
    ]);

    console.log({
      dishes,
      dishIngredients,
      ingredients,
      activeIngredients,
      pendingIngredients,
      recipeSteps,
      dishMedia,
      dishNutrition,
      randomCandidates,
      weeklySlots,
      savedDishes,
      placeDishes,
    });
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

getStats().catch(console.error);
