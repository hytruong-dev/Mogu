import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import fs from 'fs';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const active = await prisma.ingredient.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, imageUrl: true },
    orderBy: { name: 'asc' },
  });

  console.log(`Found ${active.length} active ingredients in database.`);
  fs.writeFileSync('scripts/active-db-ingredients.json', JSON.stringify(active, null, 2), 'utf-8');
  await prisma.$disconnect();
}

main();
