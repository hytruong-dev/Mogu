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
  const ingredients = await prisma.ingredient.findMany({
    where: { isActive: true },
    select: { id: true, name: true, imageUrl: true },
    take: 20,
  });

  console.log('Sample ingredient images:');
  ingredients.forEach(i => console.log(`- ${i.name}: ${i.imageUrl}`));
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});
