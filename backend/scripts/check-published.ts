import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new (pg.Pool)({ connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter } as any);

async function main() {
  const dishes = await (db as any).dish.findMany({
    where: { status: 'PUBLISHED', deletedAt: null },
    select: { id: true, name: true, status: true, media: { select: { storageKey: true, bucket: true }, take: 1 } },
    take: 5,
  });
  console.log('Published dishes:', dishes.length);
  for (const d of dishes) {
    const media = d.media[0];
    console.log(`  ${d.name} → storageKey=${media?.storageKey} bucket=${media?.bucket}`);
  }

  // Also check total
  const count = await (db as any).dish.count({ where: { status: 'PUBLISHED', deletedAt: null } });
  console.log('Total PUBLISHED:', count);

  // Check any dish status distribution
  const all = await (db as any).dish.groupBy({ by: ['status'], _count: { id: true } });
  console.log('Status distribution:', JSON.stringify(all));
}

main().finally(async () => {
  await (db as any).$disconnect();
  await pool.end();
});
