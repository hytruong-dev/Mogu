import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const dishes = await prisma.dish.findMany({
    select: { id: true, name: true, slug: true, status: true },
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`TOTAL DISHES IN DB: ${dishes.length}`);
  console.log(dishes.map((d, i) => `${i + 1}. ${d.name} (${d.status})`).join('\n'));
  await prisma.$disconnect();
}

main().catch(console.error);
