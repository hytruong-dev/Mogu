/**
 * seed-allergens.ts — Upsert 16 allergen chuẩn
 * - Rename TREENUT → TREE_NUT, SEAFOOD → giữ nhưng thêm MOLLUSK
 * - Thêm: WHEAT, MOLLUSK, CELERY, MUSTARD, SULFITE, LUPIN, OTHER
 */
import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
dotenv.config({ path: '.env.local' });

const ALLERGENS = [
  {
    code: 'PEANUT',
    name: 'Đậu phộng',
    description: 'Đậu phộng, dầu đậu phộng, bơ đậu phộng',
    displayOrder: 0,
  },
  {
    code: 'TREE_NUT',
    name: 'Các loại hạt cây',
    description: 'Hạnh nhân, óc chó, hạt điều, mắc ca, hồ đào',
    displayOrder: 1,
  },
  {
    code: 'MILK',
    name: 'Sữa',
    description: 'Sữa bò, bơ, phô mai, kem tươi, whey protein',
    displayOrder: 2,
  },
  {
    code: 'EGG',
    name: 'Trứng',
    description: 'Trứng gà, trứng vịt, mayonnaise, trứng muối',
    displayOrder: 3,
  },
  {
    code: 'FISH',
    name: 'Cá',
    description: 'Cá hồi, cá thu, cá ngừ, nước mắm, chả cá',
    displayOrder: 4,
  },
  {
    code: 'SHELLFISH',
    name: 'Giáp xác',
    description: 'Tôm, cua, ghẹ, tôm hùm, tôm tít',
    displayOrder: 5,
  },
  {
    code: 'MOLLUSK',
    name: 'Nhuyễn thể',
    description: 'Mực, bạch tuộc, nghêu, sò, ốc, hàu, điệp',
    displayOrder: 6,
  },
  {
    code: 'SOY',
    name: 'Đậu nành',
    description: 'Đậu hũ, sữa đậu nành, nước tương, tempeh, miso',
    displayOrder: 7,
  },
  {
    code: 'WHEAT',
    name: 'Lúa mì',
    description: 'Bột mì, bánh mì, mì ống, bánh ngọt từ lúa mì',
    displayOrder: 8,
  },
  {
    code: 'GLUTEN',
    name: 'Gluten',
    description: 'Lúa mì, lúa mạch, yến mạch, bia, mì sợi',
    displayOrder: 9,
  },
  {
    code: 'SESAME',
    name: 'Mè / Vừng',
    description: 'Mè trắng, mè đen, dầu mè, bột mè, tahini',
    displayOrder: 10,
  },
  {
    code: 'CELERY',
    name: 'Cần tây',
    description: 'Cần tây tươi, hạt cần tây, bột cần tây, gia vị cần tây',
    displayOrder: 11,
  },
  {
    code: 'MUSTARD',
    name: 'Mù tạt',
    description: 'Mù tạt vàng, mù tạt xanh, sốt mù tạt, hạt mù tạt',
    displayOrder: 12,
  },
  {
    code: 'SULFITE',
    name: 'Sulfite / Chất bảo quản',
    description: 'Rượu vang, trái cây sấy, đồ ngâm, giấm, tôm đông lạnh',
    displayOrder: 13,
  },
  {
    code: 'LUPIN',
    name: 'Đậu lupin',
    description: 'Bột lupin, sản phẩm từ lupin (thay thế bột mì)',
    displayOrder: 14,
  },
  {
    code: 'OTHER',
    name: 'Khác',
    description: 'Người dùng tự nhập nguyên liệu cần tránh ngoài danh sách',
    displayOrder: 15,
  },
];

async function main() {
  const pool = new (pg.Pool)({ connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter } as any) as any;

  console.log('🌱 Seed 16 allergen chuẩn...\n');

  // Rename TREENUT → TREE_NUT nếu tồn tại
  const oldTreeNut = await db.allergen.findFirst({ where: { code: 'TREENUT' } });
  if (oldTreeNut) {
    // Kiểm tra xem TREE_NUT đã tồn tại chưa
    const newTreeNut = await db.allergen.findFirst({ where: { code: 'TREE_NUT' } });
    if (!newTreeNut) {
      await db.allergen.update({ where: { id: oldTreeNut.id }, data: { code: 'TREE_NUT' } });
      console.log('  ✏️  Đổi TREENUT → TREE_NUT');
    } else {
      await db.allergen.delete({ where: { id: oldTreeNut.id } }).catch(() => {});
      console.log('  🗑  Xóa TREENUT (đã có TREE_NUT)');
    }
  }

  // Xóa SEAFOOD (nhập nhằng, đã có SHELLFISH + MOLLUSK + FISH)
  const seafood = await db.allergen.findFirst({ where: { code: 'SEAFOOD' } });
  if (seafood) {
    await db.allergen.delete({ where: { id: seafood.id } }).catch(() => {
      console.log('  ⚠️  Không thể xóa SEAFOOD (đang được tham chiếu) — bỏ qua');
    });
    console.log('  🗑  Xóa SEAFOOD (thay thế bằng FISH + SHELLFISH + MOLLUSK)');
  }

  let upserted = 0;
  for (const a of ALLERGENS) {
    await db.allergen.upsert({
      where: { code: a.code },
      update: {
        name: a.name,
        description: a.description,
        displayOrder: a.displayOrder,
        active: true,
      },
      create: {
        code: a.code,
        name: a.name,
        description: a.description,
        displayOrder: a.displayOrder,
        active: true,
      },
    });
    upserted++;
    console.log(`  ✅ ${a.code.padEnd(12)} — ${a.name}`);
  }

  const total = await db.allergen.count();
  console.log(`\n✅ Hoàn thành! Upserted: ${upserted} | Total in DB: ${total}`);

  await db.$disconnect();
  await pool.end();
}

main().catch(console.error);
