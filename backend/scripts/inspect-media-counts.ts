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
    select: {
      id: true,
      name: true,
      media: { select: { id: true, isPrimary: true, type: true } },
    },
  });

  const dishesWithMultipleMedia = dishes.filter(d => d.media.length > 1);
  const dishesWithOnly1Media = dishes.filter(d => d.media.length === 1);
  const dishesWith0Media = dishes.filter(d => d.media.length === 0);

  console.log(`Dishes with multiple images: ${dishesWithMultipleMedia.length}`);
  console.log(`Dishes with exactly 1 image: ${dishesWithOnly1Media.length}`);
  console.log(`Dishes with 0 images: ${dishesWith0Media.length}`);
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});
