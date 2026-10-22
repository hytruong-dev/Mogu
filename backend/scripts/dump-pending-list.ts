import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import fs from 'fs';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const pending = await prisma.ingredient.findMany({
    where: { status: 'PENDING_REVIEW' },
    orderBy: { name: 'asc' },
  });

  console.log(`Found ${pending.length} pending ingredients.`);
  fs.writeFileSync('scripts/current-pending-ingredients.json', JSON.stringify(pending, null, 2), 'utf-8');
  await prisma.$disconnect();
}

main();
