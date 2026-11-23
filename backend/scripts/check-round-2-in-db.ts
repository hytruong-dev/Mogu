import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { NEW_30_DISHES_TO_IMPORT } from './batch-ai-import-30-new-dishes';

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(`Checking ${NEW_30_DISHES_TO_IMPORT.length} dishes from batch-ai-import-30-new-dishes...`);
  let missing = 0;
  for (const d of NEW_30_DISHES_TO_IMPORT) {
    const found = await prisma.dish.findFirst({
      where: { name: { contains: d.name.trim() }, deletedAt: null },
      include: { media: true },
    });
    if (found) {
      console.log(`✅ [FOUND] "${d.name}" (media: ${found.media.length})`);
    } else {
      console.log(`❌ [MISSING] "${d.name}" NOT FOUND IN DB!`);
      missing++;
    }
  }
  console.log(`Missing count: ${missing}`);
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});
