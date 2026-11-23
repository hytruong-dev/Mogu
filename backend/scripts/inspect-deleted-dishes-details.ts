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
  const deletedDishes = await prisma.dish.findMany({
    where: { deletedAt: { not: null } },
    include: {
      media: true,
      province: true,
      region: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`=== 22 MÓN ĂN ĐÃ BỊ XOÁ MỀM (deletedAt is not null) ===`);
  deletedDishes.forEach((d, i) => {
    console.log(`${i + 1}. [${d.id}] "${d.name}" (${d.status}) - deletedAt: ${d.deletedAt} - media count: ${d.media.length}`);
  });
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});
