/**
 * Prisma Seed — Catalog data cho Onboarding
 * Goals, DietaryPreferences, Allergens
 *
 * Usage: npm run db:seed
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import {
  ENRICHED_CATEGORIES,
  ENRICHED_DIET_TYPES,
  ENRICHED_ALLERGENS,
} from '../src/taxonomy/constants/taxonomy.constants';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding catalog data...');

  // ── Goals ──────────────────────────────────────────────────────────────────
  const goals = [
    {
      code: 'BALANCE',
      name: 'Cân bằng',
      description: 'Ăn uống cân bằng, đa dạng món ăn',
      displayOrder: 1,
    },
    {
      code: 'LOSE_WEIGHT',
      name: 'Giảm cân',
      description: 'Ưu tiên món ít calo, giảm chất béo',
      displayOrder: 2,
    },
    {
      code: 'BUILD_MUSCLE',
      name: 'Tăng cơ',
      description: 'Ưu tiên món giàu protein',
      displayOrder: 3,
    },
    {
      code: 'EAT_HEALTHY',
      name: 'Ăn lành mạnh',
      description: 'Ưu tiên món tươi, ít chế biến',
      displayOrder: 4,
    },
    {
      code: 'SAVE_MONEY',
      name: 'Tiết kiệm',
      description: 'Gợi ý món ăn phù hợp ngân sách',
      displayOrder: 5,
    },
    {
      code: 'EXPLORE',
      name: 'Khám phá món mới',
      description: 'Thử nhiều loại món ăn đa dạng',
      displayOrder: 6,
    },
  ];

  for (const goal of goals) {
    await prisma.goal.upsert({
      where: { code: goal.code },
      update: { name: goal.name, description: goal.description, displayOrder: goal.displayOrder },
      create: { ...goal },
    });
  }
  console.log(`✅ Goals: ${goals.length} records`);

  // ── Dietary Preferences ────────────────────────────────────────────────────
  const dietaryPreferences = [
    // Khẩu vị (TASTE)
    { code: 'SPICY', type: 'TASTE' as const, name: 'Cay', displayOrder: 1 },
    { code: 'MILD', type: 'TASTE' as const, name: 'Thanh đạm', displayOrder: 2 },
    { code: 'SAVORY', type: 'TASTE' as const, name: 'Đậm vị', displayOrder: 3 },
    { code: 'SOUPY', type: 'TASTE' as const, name: 'Món nước', displayOrder: 4 },
    { code: 'DRY', type: 'TASTE' as const, name: 'Món khô', displayOrder: 5 },
    { code: 'SWEET', type: 'TASTE' as const, name: 'Ngọt', displayOrder: 6 },
    // Chế độ ăn (DIET)
    { code: 'VEGETARIAN', type: 'DIET' as const, name: 'Ăn chay', displayOrder: 10 },
    { code: 'VEGAN', type: 'DIET' as const, name: 'Thuần chay (Vegan)', displayOrder: 11 },
    { code: 'KETO', type: 'DIET' as const, name: 'Keto', displayOrder: 12 },
    { code: 'EAT_CLEAN', type: 'DIET' as const, name: 'Eat Clean', displayOrder: 13 },
    { code: 'LOW_CARB', type: 'DIET' as const, name: 'Low Carb', displayOrder: 14 },
    { code: 'HIGH_PROTEIN', type: 'DIET' as const, name: 'Nhiều đạm', displayOrder: 15 },
    { code: 'GLUTEN_FREE', type: 'DIET' as const, name: 'Không gluten', displayOrder: 16 },
    { code: 'DAIRY_FREE', type: 'DIET' as const, name: 'Không sữa', displayOrder: 17 },
  ];

  for (const pref of dietaryPreferences) {
    await prisma.dietaryPreference.upsert({
      where: { code: pref.code },
      update: { name: pref.name, type: pref.type, displayOrder: pref.displayOrder },
      create: { ...pref },
    });
  }
  console.log(`✅ DietaryPreferences: ${dietaryPreferences.length} records`);

  // ── Allergens ──────────────────────────────────────────────────────────────
  for (const allergen of ENRICHED_ALLERGENS) {
    await prisma.allergen.upsert({
      where: { code: allergen.code },
      update: {
        name: allergen.name,
        description: allergen.description,
        displayOrder: allergen.displayOrder,
      },
      create: {
        code: allergen.code,
        name: allergen.name,
        description: allergen.description,
        displayOrder: allergen.displayOrder,
      },
    });
  }
  console.log(`✅ Allergens: ${ENRICHED_ALLERGENS.length} records`);

  // ── BA-004: Regions ────────────────────────────────────────────────────────
  const regions = [
    { code: 'NORTH', name: 'Miền Bắc' },
    { code: 'CENTRAL', name: 'Miền Trung' },
    { code: 'SOUTH', name: 'Miền Nam' },
  ];
  for (const r of regions) {
    await (prisma as any).region.upsert({
      where: { code: r.code },
      update: { name: r.name },
      create: r,
    });
  }
  console.log(`✅ Regions: ${regions.length} records`);

  // ── BA-004: Provinces ──────────────────────────────────────────────────────
  const northRegion = await (prisma as any).region.findUnique({ where: { code: 'NORTH' } });
  const centralRegion = await (prisma as any).region.findUnique({ where: { code: 'CENTRAL' } });
  const southRegion = await (prisma as any).region.findUnique({ where: { code: 'SOUTH' } });

  const provinces = [
    // Miền Bắc
    { code: 'HN', name: 'Hà Nội', regionCode: 'NORTH' },
    { code: 'HP', name: 'Hải Phòng', regionCode: 'NORTH' },
    { code: 'QB', name: 'Quảng Bình', regionCode: 'NORTH' },
    { code: 'NA', name: 'Nghệ An', regionCode: 'NORTH' },
    { code: 'TH', name: 'Thanh Hóa', regionCode: 'NORTH' },
    { code: 'YB', name: 'Yên Bái', regionCode: 'NORTH' },
    { code: 'LC', name: 'Lào Cai', regionCode: 'NORTH' },
    { code: 'SL', name: 'Sơn La', regionCode: 'NORTH' },
    { code: 'HG', name: 'Hà Giang', regionCode: 'NORTH' },
    { code: 'TQ', name: 'Tuyên Quang', regionCode: 'NORTH' },
    { code: 'PY', name: 'Phú Yên', regionCode: 'NORTH' },
    { code: 'NT', name: 'Ninh Bình', regionCode: 'NORTH' },
    { code: 'HD', name: 'Hải Dương', regionCode: 'NORTH' },
    { code: 'HB', name: 'Hòa Bình', regionCode: 'NORTH' },
    { code: 'BN', name: 'Bắc Ninh', regionCode: 'NORTH' },
    // Miền Trung
    { code: 'DN', name: 'Đà Nẵng', regionCode: 'CENTRAL' },
    { code: 'HUE', name: 'Thừa Thiên Huế', regionCode: 'CENTRAL' },
    { code: 'QN', name: 'Quảng Nam', regionCode: 'CENTRAL' },
    { code: 'KH', name: 'Khánh Hòa', regionCode: 'CENTRAL' },
    { code: 'BH', name: 'Bình Định', regionCode: 'CENTRAL' },
    { code: 'GL', name: 'Gia Lai', regionCode: 'CENTRAL' },
    { code: 'KT', name: 'Kon Tum', regionCode: 'CENTRAL' },
    { code: 'DL', name: 'Đắk Lắk', regionCode: 'CENTRAL' },
    { code: 'QT', name: 'Quảng Trị', regionCode: 'CENTRAL' },
    { code: 'NTr', name: 'Ninh Thuận', regionCode: 'CENTRAL' },
    // Miền Nam
    { code: 'HCM', name: 'TP. Hồ Chí Minh', regionCode: 'SOUTH' },
    { code: 'CT', name: 'Cần Thơ', regionCode: 'SOUTH' },
    { code: 'AG', name: 'An Giang', regionCode: 'SOUTH' },
    { code: 'VT', name: 'Vũng Tàu', regionCode: 'SOUTH' },
    { code: 'BD', name: 'Bình Dương', regionCode: 'SOUTH' },
    { code: 'DN2', name: 'Đồng Nai', regionCode: 'SOUTH' },
    { code: 'LA', name: 'Long An', regionCode: 'SOUTH' },
    { code: 'TG', name: 'Tiền Giang', regionCode: 'SOUTH' },
    { code: 'BT', name: 'Bến Tre', regionCode: 'SOUTH' },
    { code: 'VL', name: 'Vĩnh Long', regionCode: 'SOUTH' },
    { code: 'KG', name: 'Kiên Giang', regionCode: 'SOUTH' },
    { code: 'CM', name: 'Cà Mau', regionCode: 'SOUTH' },
  ];
  const regionMap: Record<string, string> = {
    NORTH: northRegion?.id,
    CENTRAL: centralRegion?.id,
    SOUTH: southRegion?.id,
  };
  for (const p of provinces) {
    await (prisma as any).province.upsert({
      where: { code: p.code },
      update: { name: p.name, regionId: regionMap[p.regionCode] },
      create: { code: p.code, name: p.name, regionId: regionMap[p.regionCode] },
    });
  }
  console.log(`✅ Provinces: ${provinces.length} records`);

  // ── BA-004: Dish Categories ────────────────────────────────────────────────
  for (const dc of ENRICHED_CATEGORIES) {
    await (prisma as any).dishCategory.upsert({
      where: { code: dc.code },
      update: {
        name: dc.name,
        description: dc.description,
        displayOrder: dc.displayOrder,
      },
      create: {
        code: dc.code,
        name: dc.name,
        description: dc.description,
        displayOrder: dc.displayOrder,
      },
    });
  }
  console.log(`✅ DishCategories: ${ENRICHED_CATEGORIES.length} records`);

  // ── BA-004: Meal Type Tags ─────────────────────────────────────────────────
  const mealTypeTags = [
    { code: 'BREAKFAST', name: 'Bữa sáng', displayOrder: 1 },
    { code: 'LUNCH', name: 'Bữa trưa', displayOrder: 2 },
    { code: 'DINNER', name: 'Bữa tối', displayOrder: 3 },
    { code: 'SNACK', name: 'Bữa phụ', displayOrder: 4 },
    { code: 'ANY', name: 'Bất kỳ', displayOrder: 5 },
  ];
  for (const mt of mealTypeTags) {
    await (prisma as any).mealTypeTag.upsert({
      where: { code: mt.code },
      update: { name: mt.name, displayOrder: mt.displayOrder },
      create: mt,
    });
  }
  console.log(`✅ MealTypeTags: ${mealTypeTags.length} records`);

  // ── BA-004: Diet Types ─────────────────────────────────────────────────────
  for (const dt of ENRICHED_DIET_TYPES) {
    await (prisma as any).dietType.upsert({
      where: { code: dt.code },
      update: {
        name: dt.name,
        description: dt.description,
        displayOrder: dt.displayOrder,
      },
      create: {
        code: dt.code,
        name: dt.name,
        description: dt.description,
        displayOrder: dt.displayOrder,
      },
    });
  }
  console.log(`✅ DietTypes: ${ENRICHED_DIET_TYPES.length} records`);

  console.log('🎉 Seed completed!');
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
