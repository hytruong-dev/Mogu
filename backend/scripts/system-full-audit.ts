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
  const dishes = await prisma.dish.findMany({
    where: { deletedAt: null, status: 'PUBLISHED' },
    include: {
      province: true,
      region: true,
      media: {
        where: { isPrimary: true },
      },
      nutrition: true,
      recipeSteps: true,
      dishIngredients: true,
    },
    orderBy: [
      { regionId: 'asc' },
      { provinceId: 'asc' },
      { name: 'asc' },
    ],
  });

  const regions = await prisma.region.findMany({
    include: {
      provinces: true,
    },
  });

  console.log(`=== BÁO CÁO TỔNG QUAN HỆ THỐNG MOGU CULINARY ===`);
  console.log(`Tổng số món Published: ${dishes.length}`);

  // Breakdown by region
  const regionMap = new Map<string, typeof dishes>();
  dishes.forEach(d => {
    const regName = d.region?.name || 'Khác';
    if (!regionMap.has(regName)) regionMap.set(regName, []);
    regionMap.get(regName)!.push(d);
  });

  console.log('\n--- PHÂN BỔ THEO VÙNG MIỀN ---');
  for (const [regName, list] of regionMap.entries()) {
    console.log(`• ${regName}: ${list.length} món`);
  }

  // Check data completeness
  let missingSteps = 0;
  let missingIngredients = 0;
  let missingNutrition = 0;
  let missingMedia = 0;

  dishes.forEach(d => {
    if (d.recipeSteps.length === 0) missingSteps++;
    if (d.dishIngredients.length === 0) missingIngredients++;
    if (!d.nutrition) missingNutrition++;
    if (d.media.length === 0 || !d.media[0].storageKey) missingMedia++;
  });

  console.log('\n--- KIỂM TRA ĐỘ HOÀN THIỆN DỮ LIỆU (131 MÓN) ---');
  console.log(`• Thiếu công thức (Recipe Steps): ${missingSteps}`);
  console.log(`• Thiếu nguyên liệu (Ingredients): ${missingIngredients}`);
  console.log(`• Thiếu bảng dinh dưỡng (Nutrition): ${missingNutrition}`);
  console.log(`• Thiếu ảnh đại diện (Primary Media): ${missingMedia}`);

  // Check 64 provinces coverage
  const provinces = await prisma.province.findMany({
    include: {
      dishes: {
        where: { deletedAt: null, status: 'PUBLISHED' },
        include: {
          media: { where: { isPrimary: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  console.log('\n--- KIỂM TRA ĐỘ PHỦ 63 TỈNH THÀNH (+ HỘI AN) ---');
  console.log(`Tổng số tỉnh thành/đô thị: ${provinces.length}`);
  const uncovered = provinces.filter(p => p.dishes.length === 0);
  console.log(`Số tỉnh thành chưa có món: ${uncovered.length}`);
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});
