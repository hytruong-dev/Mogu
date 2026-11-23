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
    where: { deletedAt: null },
    include: {
      media: { where: { isPrimary: true } },
      province: true,
      region: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const realAiDishes: typeof dishes = [];
  const dummyOrScrapedDishes: typeof dishes = [];

  for (const d of dishes) {
    const m = d.media[0];
    const isDummy =
      !m ||
      m.sizeBytes === 0 ||
      (m.credit && m.credit.includes('Wikipedia')) ||
      (m.storageKey && m.storageKey.includes('ai-cover-'));

    if (isDummy) {
      dummyOrScrapedDishes.push(d);
    } else {
      realAiDishes.push(d);
    }
  }

  console.log(`=== PHÂN LOẠI ẢNH AI CHÍNH HÃNG VS ẢNH ZERO-BYTE / SCRAPED ===`);
  console.log(`Tổng số món đang hoạt động: ${dishes.length}`);
  console.log(`- ĐÃ CÓ ảnh AI Studio thực thụ: ${realAiDishes.length}`);
  console.log(`- CHƯA ĐƯỢC TẠO ẢNH BẰNG AI (Dummy/0-byte/Wikipedia fallback): ${dummyOrScrapedDishes.length}\n`);

  console.log(`--- DANH SÁCH ${dummyOrScrapedDishes.length} MÓN CẦN TẠO ẢNH AI NGAY ---`);
  dummyOrScrapedDishes.forEach((d, i) => {
    console.log(`${i + 1}. [${d.id}] "${d.name}" (${d.province?.name ?? d.region?.name})`);
  });
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});
