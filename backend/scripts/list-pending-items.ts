import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const pending = await prisma.ingredient.findMany({
    where: { status: 'PENDING_REVIEW' },
    select: { id: true, code: true, name: true, groupLabel: true },
    orderBy: { name: 'asc' },
  });

  console.log(`export const PENDING_INGREDIENTS = [`);
  for (const p of pending) {
    console.log(`  { code: '${p.code}', name: '${p.name}', group: '${p.groupLabel || 'Khác'}' },`);
  }
  console.log(`];`);
  await prisma.$disconnect();
}

main().catch(console.error);
