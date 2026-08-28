import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
dotenv.config({ path: '.env.local' });

async function main() {
  const pool = new (pg.Pool)({ connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter } as any) as any;

  // Ẩn SEAFOOD (không xóa vì đang được tham chiếu bởi user_allergens)
  // Cập nhật displayOrder = 99 và active = false
  const seafood = await db.allergen.findFirst({ where: { code: 'SEAFOOD' } });
  if (seafood) {
    await db.allergen.update({
      where: { id: seafood.id },
      data: {
        active: false,
        displayOrder: 99,
        name: '[Cũ] Hải sản',
        description: 'Mã cũ, thay thế bằng FISH + SHELLFISH + MOLLUSK',
      },
    });
    console.log('✅ Đã ẩn SEAFOOD (active=false, displayOrder=99)');
  }

  const total = await db.allergen.count({ where: { active: true } });
  console.log(`✅ Allergen active trong DB: ${total}`);
  await db.$disconnect();
  await pool.end();
}
main().catch(console.error);
