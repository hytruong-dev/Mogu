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
  const targetNames = ['Phở bò', 'Bún bò Huế', 'Cơm tấm sườn bì chả'];
  const targets = [];

  for (const name of targetNames) {
    const dish = await prisma.dish.findFirst({
      where: { name: { contains: name }, deletedAt: null, status: 'PUBLISHED' },
      include: {
        recipeSteps: { orderBy: { stepOrder: 'asc' } },
      },
    });

    if (dish) {
      targets.push({
        dishId: dish.id,
        dishName: dish.name,
        steps: dish.recipeSteps.map(s => ({
          stepId: s.id,
          stepOrder: s.stepOrder,
          instruction: s.instruction,
          durationMin: s.durationMin,
        })),
      });
    }
  }

  console.log(JSON.stringify(targets, null, 2));
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});
