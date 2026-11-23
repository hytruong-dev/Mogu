import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { NEW_30_DISHES_ROUND_3 } from './batch-ai-import-30-dishes-round-3';

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(`Checking ${NEW_30_DISHES_ROUND_3.length} dishes from Round 3...`);

  for (const d of NEW_30_DISHES_ROUND_3) {
    const found = await prisma.dish.findFirst({
      where: {
        name: { contains: d.name.trim() },
        deletedAt: null,
      },
      include: {
        media: true,
      },
    });

    if (found) {
      console.log(`✅ [FOUND] "${d.name}" -> DB: "${found.name}" (id: ${found.id}, status: ${found.status}, media: ${found.media.length})`);
    } else {
      console.log(`❌ [MISSING] "${d.name}" NOT FOUND IN DB!`);
    }
  }
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});
