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
  const pending = await prisma.dishMedia.findMany({
    where: { moderationStatus: 'PENDING' },
    include: { dish: true },
  });

  console.log(`Pending media count: ${pending.length}`);
  pending.forEach(m => {
    console.log(`- Dish: [${m.dish.id}] "${m.dish.name}", isPrimary: ${m.isPrimary}, storageKey: ${m.storageKey}`);
  });

  // Check dishes with more than 1 media
  const dishes = await prisma.dish.findMany({
    where: { deletedAt: null },
    include: { media: true },
  });
  const multiMedia = dishes.filter(d => d.media.length > 1);
  console.log(`Dishes with > 1 media: ${multiMedia.length}`);
  multiMedia.forEach(d => {
    console.log(`- Dish: [${d.id}] "${d.name}", media count: ${d.media.length}`);
    d.media.forEach(m => console.log(`   * ${m.id} | isPrimary: ${m.isPrimary} | status: ${m.moderationStatus} | ${m.storageKey}`));
  });
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});
