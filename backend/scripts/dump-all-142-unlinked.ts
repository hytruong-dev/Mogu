import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

  const unlinked = await prisma.dishIngredient.findMany({
    where: { ingredientId: null },
    select: {
      id: true,
      rawText: true,
      parsedName: true,
      dish: { select: { id: true, name: true } },
    },
    orderBy: { dish: { name: 'asc' } },
  });

  console.log(`id | dish | rawText | parsedName`);
  for (const u of unlinked) {
    console.log(`[${u.dish.name}] raw: "${u.rawText}" | parsed: "${u.parsedName}"`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
