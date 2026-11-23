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

  console.log(`=== DANH SÁCH 131 MÓN ĂN VÀ KEY ẢNH ===`);
  const patternStats: Record<string, number> = {};

  dishes.forEach((d, i) => {
    const key = d.media[0]?.storageKey || 'NO_KEY';
    let pattern = 'other';
    if (key.includes('ai-photo-')) pattern = 'ai-photo-timestamp';
    else if (key.includes('ai-cover-')) pattern = 'ai-cover-timestamp (AI-import)';
    else if (key.includes('ai-generated-')) pattern = 'ai-generated-timestamp';
    else if (key.includes('_179')) pattern = 'named_timestamp (Custom AI Studio)';
    
    patternStats[pattern] = (patternStats[pattern] || 0) + 1;

    console.log(`${i + 1}. [${d.id}] "${d.name}" (${d.province?.name ?? d.region?.name}) -> [${pattern}] ${key}`);
  });

  console.log('\nPattern Breakdown:', patternStats);
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});
