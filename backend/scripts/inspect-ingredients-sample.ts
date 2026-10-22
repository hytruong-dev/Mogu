import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const sample = await p.ingredient.findMany({
    where: { imageUrl: { not: null } },
    select: { name: true, imageUrl: true, imageKey: true, imageStatus: true },
    take: 5,
  });
  console.log(JSON.stringify(sample, null, 2));
  await p.$disconnect();
}

main().catch(console.error);
