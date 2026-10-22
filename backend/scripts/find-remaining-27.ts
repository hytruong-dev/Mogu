import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const pending = await prisma.ingredient.findMany({
    where: { status: 'PENDING_REVIEW' },
    select: { id: true, code: true, name: true, imageUrl: true },
    orderBy: { name: 'asc' },
  });

  const remaining = pending.filter(p => !p.imageUrl?.includes('supabase.co/storage/v1/object/public/ingredient-images'));
  console.log(`Total remaining without Supabase URL: ${remaining.length} / ${pending.length}`);
  remaining.forEach((r, idx) => {
    console.log(`${idx + 1}. [${r.code}] "${r.name}" (Current: ${r.imageUrl?.slice(0, 50)}...)`);
  });

  await prisma.$disconnect();
}

main();
