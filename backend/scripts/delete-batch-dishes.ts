import * as path from 'path';
import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  // Xóa các món nháp được tạo sau 2026-10-15T05:00:00Z (mẻ 61 món vừa tạo)
  const cutoff = new Date('2026-10-15T05:00:00.000Z');
  
  const toDelete = await prisma.dish.findMany({
    where: {
      status: 'DRAFT',
      createdAt: { gte: cutoff },
    },
    select: { id: true, name: true },
  });

  console.log(`Tìm thấy ${toDelete.length} món nháp tạo lúc hoặc sau 05:00 UTC để xóa.`);

  const ids = toDelete.map((d: any) => d.id);
  if (ids.length > 0) {
    // Xóa dish
    const res = await prisma.dish.deleteMany({
      where: { id: { in: ids } },
    });
    console.log(`Đã xóa ${res.count} món khỏi database.`);
  }

  const remaining = await prisma.dish.count({ where: { deletedAt: null } });
  console.log(`Số món còn lại trong DB: ${remaining}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
