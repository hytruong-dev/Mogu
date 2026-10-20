import * as path from 'path';
import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
  const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    const totalDishesBefore = await prisma.dish.count();
    console.log(`[Before] Tổng số món ăn trong DB: ${totalDishesBefore}`);

    const [
      dishIngredients,
      dishMedia,
      dishNutrition,
      recipeSteps,
      dishCategories,
      dishAllergens,
      dishDietTypes,
      dishMealTypes,
      dishGoals,
      dishSources,
    ] = await Promise.all([
      prisma.dishIngredient.count(),
      prisma.dishMedia.count(),
      prisma.dishNutrition.count(),
      prisma.recipeStep.count(),
      prisma.dishCategoryLink.count(),
      prisma.dishAllergen.count(),
      prisma.dishDietType.count(),
      prisma.dishMealType.count(),
      prisma.dishGoal.count(),
      prisma.dishSource.count(),
    ]);

    console.log(`[Before] Chi tiết dữ liệu liên quan đến món ăn:`, {
      dishIngredients,
      dishMedia,
      dishNutrition,
      recipeSteps,
      dishCategories,
      dishAllergens,
      dishDietTypes,
      dishMealTypes,
      dishGoals,
      dishSources,
    });

    // 1. Unlink parentDishId to avoid self-reference FK issues
    await prisma.dish.updateMany({
      where: { parentDishId: { not: null } },
      data: { parentDishId: null },
    });

    // 2. Unlink import_jobs resultDishId
    await prisma.importJob.updateMany({
      where: { resultDishId: { not: null } },
      data: { resultDishId: null },
    });

    // 3. Clear weekly plan slots if any reference dishes
    const weeklySlotsCount = await prisma.weeklyPlanSlot.count();
    if (weeklySlotsCount > 0) {
      console.log(`Xóa ${weeklySlotsCount} weekly plan slots...`);
      await prisma.weeklyPlanSlot.deleteMany({});
    }

    // 4. Clear place dishes if any
    const placeDishesCount = await prisma.placeDish.count();
    if (placeDishesCount > 0) {
      console.log(`Xóa ${placeDishesCount} place dishes...`);
      await prisma.placeDish.deleteMany({});
    }

    // 5. Clear saved dishes if any
    const savedDishesCount = await prisma.savedDish.count();
    if (savedDishesCount > 0) {
      console.log(`Xóa ${savedDishesCount} saved dishes...`);
      await prisma.savedDish.deleteMany({});
    }

    // 6. Delete all dishes (Cascades to dishIngredients, media, nutrition, recipeSteps, categories, etc.)
    const deleteResult = await prisma.dish.deleteMany({});
    console.log(`[Action] Đã xóa thành công ${deleteResult.count} món ăn.`);

    // 7. Verify counts after deletion
    const totalDishesAfter = await prisma.dish.count();
    const remainingDishIngredients = await prisma.dishIngredient.count();
    const remainingMedia = await prisma.dishMedia.count();
    const remainingNutrition = await prisma.dishNutrition.count();
    const remainingSteps = await prisma.recipeStep.count();

    console.log(`[After] Kiểm tra số lượng sau khi xóa:`, {
      totalDishes: totalDishesAfter,
      dishIngredients: remainingDishIngredients,
      dishMedia: remainingMedia,
      dishNutrition: remainingNutrition,
      recipeSteps: remainingSteps,
    });

    // Verify ingredients dictionary is still safe
    const totalIngredients = await prisma.ingredient.count();
    console.log(`[Preserved] Từ điển nguyên liệu (Ingredients) vẫn được giữ nguyên: ${totalIngredients} nguyên liệu.`);

  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Lỗi khi xóa món ăn:', err);
  process.exit(1);
});
