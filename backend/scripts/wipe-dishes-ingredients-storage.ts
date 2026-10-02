/**
 * Script dọn sạch kho món ăn, kho nguyên liệu và toàn bộ ảnh mồ côi liên quan:
 * 1. Supabase Storage:
 *    - Bucket `dish-images`: xóa toàn bộ file thuộc prefix `dishes/` và `test-put.png` (GIỮ NGUYÊN `avatars/` và `community/`).
 *    - Bucket `ingredient-images`: xóa toàn bộ file ảnh nguyên liệu (550+ files).
 * 2. Database:
 *    - Xóa `import_jobs` (lịch sử nhập món bằng AI).
 *    - Xóa `ingredient_image_candidates`.
 *    - Xóa `dish_ingredients`, `dish_media`, `recipe_steps`, `dish_sources`, `dish_nutrition`...
 *    - Xóa `dishes`.
 *    - Xóa `ingredients`.
 *
 * Chạy lệnh:
 *   npx ts-node -r tsconfig-paths/register scripts/wipe-dishes-ingredients-storage.ts
 */

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { createClient } from '@supabase/supabase-js';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

async function listAllFiles(
  supabase: any,
  bucket: string,
  prefix = '',
): Promise<string[]> {
  const filePaths: string[] = [];
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 1000,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' },
  });

  if (error || !data) {
    console.error(`Lỗi khi list ${bucket}/${prefix}:`, error?.message || error);
    return filePaths;
  }

  for (const item of data) {
    const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
    // Thư mục trong Supabase storage có id === null
    if (item.id === null) {
      const subFiles = await listAllFiles(supabase, bucket, itemPath);
      filePaths.push(...subFiles);
    } else {
      filePaths.push(itemPath);
    }
  }

  return filePaths;
}

async function removeInChunks(
  supabase: any,
  bucket: string,
  paths: string[],
  chunkSize = 100,
): Promise<{ deleted: number; errors: number }> {
  let deleted = 0;
  let errors = 0;

  for (let i = 0; i < paths.length; i += chunkSize) {
    const chunk = paths.slice(i, i + chunkSize);
    const { error } = await supabase.storage.from(bucket).remove(chunk);
    if (error) {
      console.error(`Lỗi khi xóa chunk [${i}..${i + chunk.length}] trong bucket ${bucket}:`, error.message);
      errors += chunk.length;
    } else {
      deleted += chunk.length;
    }
  }

  return { deleted, errors };
}

async function main() {
  console.log('================================================================');
  console.log('🚀 BẮT ĐẦU DỌN DẸP KHO MÓN ĂN, NGUYÊN LIỆU VÀ ẢNH TRÊN DB/STORAGE');
  console.log('================================================================');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });
  const prisma = app.get(PrismaService);

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong môi trường.');
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── 1. Thống kê trước khi xóa ──────────────────────────────────────────────
  console.log('\n📊 1. Kiểm tra số lượng dữ liệu hiện tại trong Database...');
  const [
    beforeDishes,
    beforeIngredients,
    beforeCandidates,
    beforeDishMedia,
    beforeRecipeSteps,
    beforeDishIngredients,
    beforeImportJobs,
    beforeProfiles,
    beforeCommunityPosts,
    beforeFoodScanEvents,
  ] = await Promise.all([
    prisma.db.dish.count(),
    prisma.db.ingredient.count(),
    prisma.db.ingredientImageCandidate.count(),
    prisma.db.dishMedia.count(),
    prisma.db.recipeStep.count(),
    prisma.db.dishIngredient.count(),
    prisma.db.importJob.count(),
    prisma.db.profile.count(),
    prisma.db.communityPost.count(),
    prisma.db.foodScanEvent.count(),
  ]);

  console.log({
    dishes: beforeDishes,
    ingredients: beforeIngredients,
    ingredientImageCandidates: beforeCandidates,
    dishMedia: beforeDishMedia,
    recipeSteps: beforeRecipeSteps,
    dishIngredients: beforeDishIngredients,
    importJobs: beforeImportJobs,
    profiles: beforeProfiles,
    communityPosts: beforeCommunityPosts,
    foodScanEvents: beforeFoodScanEvents,
  });

  // ── 2. Quét và dọn dẹp Supabase Storage ─────────────────────────────────────
  console.log('\n🗑️  2. Quét Supabase Storage để xóa ảnh không còn dùng...');

  // A. Bucket `dish-images`
  console.log('--- Quét bucket "dish-images" ---');
  const allDishBucketFiles = await listAllFiles(supabase, 'dish-images');
  console.log(`Tổng file trong dish-images: ${allDishBucketFiles.length}`);

  // Phân loại file: CHỈ xóa dishes/* và test files; BẢO VỆ avatars/* và community/*
  const dishFilesToDelete = allDishBucketFiles.filter(
    (f) => f.startsWith('dishes/') || f === 'test-put.png',
  );
  const preservedDishBucketFiles = allDishBucketFiles.filter(
    (f) => !dishFilesToDelete.includes(f),
  );

  console.log(`Số file ảnh món ăn cần xóa (dishes/*): ${dishFilesToDelete.length}`);
  console.log(`Số file giữ nguyên (avatars/*, community/*): ${preservedDishBucketFiles.length}`);
  console.log('Danh sách file được giữ nguyên trong dish-images:', preservedDishBucketFiles);

  if (dishFilesToDelete.length > 0) {
    const res = await removeInChunks(supabase, 'dish-images', dishFilesToDelete);
    console.log(`✅ Đã xóa ${res.deleted}/${dishFilesToDelete.length} files trong dish-images (lỗi: ${res.errors}).`);
  }

  // B. Bucket `ingredient-images`
  console.log('\n--- Quét bucket "ingredient-images" ---');
  const allIngBucketFiles = await listAllFiles(supabase, 'ingredient-images');
  console.log(`Tổng file ảnh nguyên liệu cần xóa trong ingredient-images: ${allIngBucketFiles.length}`);

  if (allIngBucketFiles.length > 0) {
    const res = await removeInChunks(supabase, 'ingredient-images', allIngBucketFiles);
    console.log(`✅ Đã xóa ${res.deleted}/${allIngBucketFiles.length} files trong ingredient-images (lỗi: ${res.errors}).`);
  }

  // ── 3. Dọn dẹp trong Database ──────────────────────────────────────────────
  console.log('\n🗄️  3. Xóa dữ liệu trong Database...');

  // A. Xóa Import Jobs
  const deletedImportJobs = await prisma.db.importJob.deleteMany({});
  console.log(`✅ Đã xóa ${deletedImportJobs.count} bản ghi import_jobs.`);

  // B. Xóa Image Candidates của nguyên liệu
  const deletedCandidates = await prisma.db.ingredientImageCandidate.deleteMany({});
  console.log(`✅ Đã xóa ${deletedCandidates.count} bản ghi ingredient_image_candidates.`);

  // C. Xóa liên kết nguyên liệu - món ăn
  const deletedDishIngredients = await prisma.db.dishIngredient.deleteMany({});
  console.log(`✅ Đã xóa ${deletedDishIngredients.count} bản ghi dish_ingredients.`);

  // D. Xóa media và các bước nấu của món ăn
  const deletedMedia = await prisma.db.dishMedia.deleteMany({});
  console.log(`✅ Đã xóa ${deletedMedia.count} bản ghi dish_media.`);

  const deletedSteps = await prisma.db.recipeStep.deleteMany({});
  console.log(`✅ Đã xóa ${deletedSteps.count} bản ghi recipe_steps.`);

  const deletedSources = await prisma.db.dishSource.deleteMany({});
  console.log(`✅ Đã xóa ${deletedSources.count} bản ghi dish_sources.`);

  const deletedNutrition = await prisma.db.dishNutrition.deleteMany({});
  console.log(`✅ Đã xóa ${deletedNutrition.count} bản ghi dish_nutrition.`);

  const deletedCategories = await prisma.db.dishCategoryLink.deleteMany({});
  console.log(`✅ Đã xóa ${deletedCategories.count} bản ghi dish_category_links.`);

  const deletedMealTypes = await prisma.db.dishMealType.deleteMany({});
  console.log(`✅ Đã xóa ${deletedMealTypes.count} bản ghi dish_meal_types.`);

  const deletedDietTypes = await prisma.db.dishDietType.deleteMany({});
  console.log(`✅ Đã xóa ${deletedDietTypes.count} bản ghi dish_diet_types.`);

  const deletedGoals = await prisma.db.dishGoal.deleteMany({});
  console.log(`✅ Đã xóa ${deletedGoals.count} bản ghi dish_goals.`);

  const deletedAllergens = await prisma.db.dishAllergen.deleteMany({});
  console.log(`✅ Đã xóa ${deletedAllergens.count} bản ghi dish_allergens.`);

  // E. Xóa các món ăn
  // Cắt liên kết parentDishId trước để tránh cycle nếu có
  await prisma.db.dish.updateMany({
    where: { parentDishId: { not: null } },
    data: { parentDishId: null },
  });
  const deletedDishes = await prisma.db.dish.deleteMany({});
  console.log(`✅ Đã xóa ${deletedDishes.count} bản ghi dishes.`);

  // F. Xóa nguyên liệu
  // Cắt liên kết mergedIntoId trước
  await prisma.db.ingredient.updateMany({
    where: { mergedIntoId: { not: null } },
    data: { mergedIntoId: null },
  });
  const deletedIngredients = await prisma.db.ingredient.deleteMany({});
  console.log(`✅ Đã xóa ${deletedIngredients.count} bản ghi ingredients.`);

  // ── 4. Xác nhận trạng thái sau khi dọn dẹp ─────────────────────────────────
  console.log('\n🔍 4. Xác minh trạng thái sau khi hoàn tất...');
  const [
    afterDishes,
    afterIngredients,
    afterCandidates,
    afterDishMedia,
    afterRecipeSteps,
    afterDishIngredients,
    afterImportJobs,
    afterProfiles,
    afterCommunityPosts,
    afterFoodScanEvents,
  ] = await Promise.all([
    prisma.db.dish.count(),
    prisma.db.ingredient.count(),
    prisma.db.ingredientImageCandidate.count(),
    prisma.db.dishMedia.count(),
    prisma.db.recipeStep.count(),
    prisma.db.dishIngredient.count(),
    prisma.db.importJob.count(),
    prisma.db.profile.count(),
    prisma.db.communityPost.count(),
    prisma.db.foodScanEvent.count(),
  ]);

  const afterDishBucketFiles = await listAllFiles(supabase, 'dish-images');
  const afterIngBucketFiles = await listAllFiles(supabase, 'ingredient-images');

  console.log('KẾT QUẢ CUỐI CÙNG TRONG DATABASE:');
  console.table({
    'Món ăn (dishes)': afterDishes,
    'Nguyên liệu (ingredients)': afterIngredients,
    'Ứng viên ảnh nguyên liệu': afterCandidates,
    'Ảnh/video món ăn (dish_media)': afterDishMedia,
    'Bước công thức (recipe_steps)': afterRecipeSteps,
    'Nguyên liệu món (dish_ingredients)': afterDishIngredients,
    'Import Jobs (lịch sử nhập món)': afterImportJobs,
    'Hồ sơ người dùng (profiles - GIỮ NGUYÊN)': afterProfiles,
    'Bài viết cộng đồng (posts - GIỮ NGUYÊN)': afterCommunityPosts,
    'Food scan events (GIỮ NGUYÊN)': afterFoodScanEvents,
  });

  console.log('KẾT QUẢ CUỐI CÙNG TRÊN SUPABASE STORAGE:');
  console.log(`- File còn lại trong "ingredient-images": ${afterIngBucketFiles.length}`);
  console.log(`- File còn lại trong "dish-images": ${afterDishBucketFiles.length} (avatars & community an toàn)`);
  console.log('  Chi tiết các file còn lại trong dish-images:', afterDishBucketFiles);

  await app.close();
  console.log('\n🎉 DỌN DẸP HOÀN TẤT THÀNH CÔNG!');
}

main().catch((err) => {
  console.error('❌ Lỗi khi thực hiện dọn dẹp:', err);
  process.exit(1);
});
