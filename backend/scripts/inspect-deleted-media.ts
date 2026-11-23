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
  const media = await prisma.dishMedia.findMany({
    include: { dish: true },
  });
  console.log('Total media records in DB:', media.length);
  const deletedDishMedia = media.filter(m => m.dish.deletedAt !== null);
  console.log('Media for soft-deleted dishes:', deletedDishMedia.length);
  deletedDishMedia.forEach(m => console.log(`Deleted dish [${m.dish.id}] "${m.dish.name}"`));
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});
