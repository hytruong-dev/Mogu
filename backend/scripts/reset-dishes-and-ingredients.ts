/**
 * Script xóa toàn bộ dữ liệu món ăn (dishes) và kho nguyên liệu (ingredients)
 * Chạy trong transaction an toàn, xử lý triệt để các ràng buộc khóa ngoại (Foreign Keys).
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

async function resetDishesAndIngredients() {
  const pool = new pg.Pool({
    connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  console.log('========================================================');
  console.log('   TIẾN HÀNH XÓA DỮ LIỆU MÓN ĂN VÀ NGUYÊN LIỆU          ');
  console.log('========================================================\n');

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Xóa các bảng phụ thuộc có ràng buộc Restrict tới Dish
      console.log('1. Đang xóa random_candidates...');
      const delRandomCandidates = await tx.randomCandidate.deleteMany();
      console.log(`   ✓ Đã xóa ${delRandomCandidates.count} dòng trong random_candidates`);

      console.log('2. Đang xóa weekly_plan_slot_swaps & weekly_plan_slots...');
      const delSwaps = await tx.weeklyPlanSlotSwap.deleteMany();
      const delSlots = await tx.weeklyPlanSlot.deleteMany();
      console.log(`   ✓ Đã xóa ${delSwaps.count} swaps và ${delSlots.count} weekly_plan_slots`);

      // 2. Xóa dish_ingredients
      console.log('3. Đang xóa dish_ingredients...');
      const delDishIngredients = await tx.dishIngredient.deleteMany();
      console.log(`   ✓ Đã xóa ${delDishIngredients.count} dòng trong dish_ingredients`);

      // 3. Xóa tự tham chiếu của dishes (parent_dish_id)
      console.log('4. Đang gỡ bỏ quan hệ cha-con (parent_dish_id) của dishes...');
      await tx.dish.updateMany({
        where: { parentDishId: { not: null } },
        data: { parentDishId: null },
      });

      // 4. Xóa toàn bộ dishes (các bảng con cascade: recipe_steps, dish_nutrition, dish_media, place_dishes... sẽ tự xóa theo)
      console.log('5. Đang xóa toàn bộ bảng dishes...');
      const delDishes = await tx.dish.deleteMany();
      console.log(`   ✓ Đã xóa ${delDishes.count} món ăn trong bảng dishes`);

      // 5. Gỡ bỏ khóa ngoại liên kết tới ingredients
      console.log('6. Đang gỡ liên kết trong user_avoided_ingredients...');
      const updatedAvoided = await tx.userAvoidedIngredient.updateMany({
        where: { ingredientId: { not: null } },
        data: { ingredientId: null },
      });
      console.log(`   ✓ Đã cập nhật ${updatedAvoided.count} dòng trong user_avoided_ingredients`);

      console.log('7. Đang gỡ quan hệ gộp (merged_into_id) của ingredients...');
      await tx.ingredient.updateMany({
        where: { mergedIntoId: { not: null } },
        data: { mergedIntoId: null },
      });

      console.log('8. Đang xóa ingredient_image_candidates...');
      const delImageCandidates = await tx.ingredientImageCandidate.deleteMany();
      console.log(`   ✓ Đã xóa ${delImageCandidates.count} dòng trong ingredient_image_candidates`);

      // 6. Xóa toàn bộ ingredients
      console.log('9. Đang xóa toàn bộ bảng ingredients...');
      const delIngredients = await tx.ingredient.deleteMany();
      console.log(`   ✓ Đã xóa ${delIngredients.count} nguyên liệu trong bảng ingredients`);
    });

    // 7. Kiểm tra lại toàn bộ sau khi xóa
    console.log('\n--- Đang kiểm tra lại số lượng sau khi xóa ---');
    const [
      dishCount,
      dishIngredientCount,
      ingredientCount,
      recipeStepCount,
      dishNutritionCount,
      dishMediaCount,
      placeDishCount,
      randomCandidateCount,
      weeklySlotCount,
    ] = await Promise.all([
      prisma.dish.count(),
      prisma.dishIngredient.count(),
      prisma.ingredient.count(),
      prisma.recipeStep.count(),
      prisma.dishNutrition.count(),
      prisma.dishMedia.count(),
      prisma.placeDish.count(),
      prisma.randomCandidate.count(),
      prisma.weeklyPlanSlot.count(),
    ]);

    console.table([
      { 'Bảng': 'dishes (Món ăn)', 'Còn lại': dishCount },
      { 'Bảng': 'dish_ingredients (Thành phần món)', 'Còn lại': dishIngredientCount },
      { 'Bảng': 'ingredients (Kho nguyên liệu)', 'Còn lại': ingredientCount },
      { 'Bảng': 'recipe_steps (Các bước nấu)', 'Còn lại': recipeStepCount },
      { 'Bảng': 'dish_nutrition (Dinh dưỡng)', 'Còn lại': dishNutritionCount },
      { 'Bảng': 'dish_media (Hình ảnh/Media)', 'Còn lại': dishMediaCount },
      { 'Bảng': 'place_dishes (Liên kết quán)', 'Còn lại': placeDishCount },
      { 'Bảng': 'random_candidates', 'Còn lại': randomCandidateCount },
      { 'Bảng': 'weekly_plan_slots', 'Còn lại': weeklySlotCount },
    ]);

    console.log('\n========================================================');
    console.log('✓ ĐÃ XÓA TOÀN BỘ DỮ LIỆU THÀNH CÔNG VÀ SẴN SÀNG THIẾT LẬP MỚI');
    console.log('========================================================\n');
  } catch (err) {
    console.error('\n❌ Lỗi khi thực hiện xóa dữ liệu:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

resetDishesAndIngredients();
