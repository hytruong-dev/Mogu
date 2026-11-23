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
  const targetNames = ['Phở bò', 'Bún bò Huế', 'Cơm tấm', 'Bánh đa cua', 'Mì Quảng'];
  for (const name of targetNames) {
    const dish = await prisma.dish.findFirst({
      where: { name: { contains: name }, deletedAt: null, status: 'PUBLISHED' },
      include: {
        province: true,
        recipeSteps: { orderBy: { stepOrder: 'asc' } },
      },
    });

    if (dish) {
      console.log(`\n========================================`);
      console.log(`Dish [${dish.id}] "${dish.name}" (${dish.province?.name}) - ${dish.recipeSteps.length} steps`);
      dish.recipeSteps.forEach(s => {
        const titleMatch = s.instruction.match(/\*\*(.*?)\*\*/);
        const title = titleMatch ? titleMatch[1] : s.instruction.slice(0, 40);
        console.log(`  Step ${s.stepOrder}: "${title}"`);
      });
    }
  }
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});
