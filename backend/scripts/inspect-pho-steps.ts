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
  const dish = await prisma.dish.findFirst({
    where: { name: { contains: 'Phở bò' }, deletedAt: null },
    include: {
      recipeSteps: { orderBy: { stepOrder: 'asc' } },
      media: true,
    },
  });

  if (!dish) {
    console.log('Dish not found');
    return;
  }

  console.log(`Dish: [${dish.id}] "${dish.name}"`);
  console.log(`Media count: ${dish.media.length}`);
  console.log('Recipe Steps:');
  dish.recipeSteps.forEach(s => {
    console.log(`Step ${s.stepOrder}: ${s.instruction.slice(0, 80)}... (Image: ${s.imageUrl || 'None'})`);
  });
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});
