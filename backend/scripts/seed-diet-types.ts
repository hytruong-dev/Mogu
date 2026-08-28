/**
 * seed-diet-types.ts — Upsert 12 chế độ ăn chuẩn
 */
import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
dotenv.config({ path: '.env.local' });

const DIET_TYPES = [
  { code: 'NORMAL',       name: 'Ăn thông thường',      description: 'Không có giới hạn đặc biệt, ăn đa dạng tất cả nhóm thực phẩm', sortOrder: 0 },
  { code: 'VEGETARIAN',   name: 'Ăn chay có trứng/sữa', description: 'Không ăn thịt, cá, hải sản nhưng vẫn dùng trứng và sữa',        sortOrder: 1 },
  { code: 'VEGAN',        name: 'Thuần chay',            description: 'Không dùng bất kỳ sản phẩm nào từ động vật',                     sortOrder: 2 },
  { code: 'PESCATARIAN',  name: 'Chay có cá',            description: 'Không ăn thịt đỏ và gia cầm, vẫn ăn cá và hải sản',             sortOrder: 3 },
  { code: 'HALAL',        name: 'Halal',                 description: 'Thực phẩm theo tiêu chuẩn Halal của Hồi giáo',                   sortOrder: 4 },
  { code: 'KETO',         name: 'Keto',                  description: 'Ít tinh bột (< 20g/ngày), nhiều chất béo tốt và đạm',            sortOrder: 5 },
  { code: 'LOW_CARB',     name: 'Ít tinh bột',           description: 'Hạn chế cơm, bún, bánh mì, đường — phù hợp giảm cân và ổn định đường huyết', sortOrder: 6 },
  { code: 'HIGH_PROTEIN', name: 'Giàu đạm',              description: 'Ưu tiên thực phẩm giàu protein, phù hợp tăng cơ và no lâu',     sortOrder: 7 },
  { code: 'LOW_CALORIE',  name: 'Ít calo',               description: 'Kiểm soát lượng calo nạp vào, phù hợp kiểm soát cân nặng',      sortOrder: 8 },
  { code: 'LOW_FAT',      name: 'Ít chất béo',           description: 'Hạn chế món chiên, thực phẩm nhiều mỡ và da',                   sortOrder: 9 },
  { code: 'LOW_SODIUM',   name: 'Ít muối',               description: 'Hạn chế nước mắm, gia vị mặn và đồ chế biến sẵn',              sortOrder: 10 },
  { code: 'GLUTEN_FREE',  name: 'Không gluten',          description: 'Không dùng lúa mì, mì, bánh mì và các sản phẩm chứa gluten',    sortOrder: 11 },
];

async function main() {
  const pool = new (pg.Pool)({ connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter } as any) as any;

  console.log('🌱 Seed 12 diet types...\n');

  // Xóa OMNIVORE (thay bằng NORMAL)
  const omnivore = await db.dietType.findFirst({ where: { code: 'OMNIVORE' } });
  if (omnivore) {
    // Cập nhật references trước nếu có
    await db.dietType.delete({ where: { id: omnivore.id } }).catch(() => {});
    console.log('  🗑  Đã xóa OMNIVORE');
  }

  let upserted = 0;
  for (const dt of DIET_TYPES) {
    await db.dietType.upsert({
      where: { code: dt.code },
      update: {
        name: dt.name,
        description: dt.description,
        isActive: true,
      },
      create: {
        code: dt.code,
        name: dt.name,
        description: dt.description,
        isActive: true,
      },
    });
    upserted++;
    console.log(`  ✅ ${dt.code.padEnd(15)} — ${dt.name}`);
  }

  const total = await db.dietType.count();
  console.log(`\n✅ Hoàn thành! Upserted: ${upserted} | Total in DB: ${total}`);

  await db.$disconnect();
  await pool.end();
}

main().catch(console.error);
