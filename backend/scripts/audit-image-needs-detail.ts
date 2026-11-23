import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const allDishes = await prisma.dish.findMany({
    where: { deletedAt: null },
    include: {
      media: true,
      province: true,
      region: true,
      recipeSteps: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const published = allDishes.filter(d => d.status === 'PUBLISHED');
  const draft = allDishes.filter(d => d.status === 'DRAFT');
  const archived = allDishes.filter(d => d.status === 'ARCHIVED');

  const publishedWithPrimary = published.filter(d => d.media.some(m => m.isPrimary));
  const publishedWithoutPrimary = published.filter(d => !d.media.some(m => m.isPrimary));

  const draftWithPrimary = draft.filter(d => d.media.some(m => m.isPrimary));
  const draftWithoutPrimary = draft.filter(d => !d.media.some(m => m.isPrimary));

  // Recipe steps without image
  const stepsWithoutImg = await prisma.recipeStep.count({
    where: { imageUrl: null },
  });
  const totalSteps = await prisma.recipeStep.count();

  // Ingredients without image
  const ingredientsWithoutImg = await prisma.ingredient.count({
    where: { imageUrl: null, isActive: true },
  });
  const totalIngredients = await prisma.ingredient.count({
    where: { isActive: true },
  });

  console.log('=== CHI TIẾT TỔNG THỂ HÌNH ẢNH MÓN ĂN & HỆ THỐNG MOGU ===');
  console.log(`Tổng số món ăn (active): ${allDishes.length}`);
  console.log(`- Món ĐÃ XUẤT BẢN (PUBLISHED): ${published.length}`);
  console.log(`  + Đã có ảnh đại diện (Primary): ${publishedWithPrimary.length}`);
  console.log(`  + Chưa có ảnh đại diện: ${publishedWithoutPrimary.length}`);
  if (publishedWithoutPrimary.length > 0) {
    console.log('  Danh sách các món published chưa có ảnh:');
    publishedWithoutPrimary.forEach((d, i) => {
      console.log(`    ${i + 1}. [${d.id}] "${d.name}" (${d.province?.name ?? d.region?.name})`);
    });
  }

  console.log(`- Món BẢN NHÁP (DRAFT): ${draft.length}`);
  console.log(`  + Đã có ảnh đại diện: ${draftWithPrimary.length}`);
  console.log(`  + Chưa có ảnh đại diện: ${draftWithoutPrimary.length}`);
  if (draftWithoutPrimary.length > 0) {
    console.log('  Danh sách các món draft chưa có ảnh:');
    draftWithoutPrimary.forEach((d, i) => {
      console.log(`    ${i + 1}. [${d.id}] "${d.name}"`);
    });
  }

  console.log(`- Các bước nấu ăn (Recipe Steps): ${totalSteps - stepsWithoutImg}/${totalSteps} có ảnh (Thiếu: ${stepsWithoutImg})`);
  console.log(`- Nguyên liệu (Ingredients): ${totalIngredients - ingredientsWithoutImg}/${totalIngredients} có ảnh (Thiếu: ${ingredientsWithoutImg})`);
}

main().finally(() => prisma.$disconnect());
