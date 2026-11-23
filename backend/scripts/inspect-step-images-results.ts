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
    where: {
      name: { in: ['Phở bò', 'Bún bò Huế', 'Cơm tấm sườn bì chả'] },
      deletedAt: null,
    },
    include: {
      recipeSteps: { orderBy: { stepOrder: 'asc' } },
    },
    orderBy: { name: 'asc' },
  });

  dishes.forEach(d => {
    console.log(`\n==============================================`);
    console.log(`🍲 [${d.name}]`);
    d.recipeSteps.forEach(s => {
      console.log(`  Step ${s.stepOrder}: ${s.imageUrl ? '✅ ' + s.imageUrl : '❌ Chưa có ảnh'}`);
    });
  });
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});
