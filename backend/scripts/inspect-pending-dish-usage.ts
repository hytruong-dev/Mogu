import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const pending = await prisma.ingredient.findMany({
    where: { status: 'PENDING_REVIEW' },
    select: {
      id: true,
      code: true,
      name: true,
      dishIngredients: {
        select: {
          dish: { select: { name: true } }
        }
      }
    }
  });

  console.log(`Tổng pending: ${pending.length}`);
  const used = pending.filter(p => p.dishIngredients.length > 0);
  console.log(`Số pending đang được dùng trong món ăn: ${used.length}`);
  
  used.forEach((u, i) => {
    const dishes = u.dishIngredients.map(d => d.dish.name).join(', ');
    console.log(`${i+1}. [${u.code}] "${u.name}" -> Dùng trong: ${dishes}`);
  });
}

main().catch(console.error);
