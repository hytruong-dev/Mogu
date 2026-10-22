import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const sample = await prisma.ingredient.findMany({
    where: { imageUrl: { not: null } },
    take: 10,
    select: { name: true, imageUrl: true }
  });
  console.log('Sample ingredient imageUrls:');
  for (const s of sample) {
    console.log(`- ${s.name}: ${s.imageUrl}`);
  }
  await prisma.$disconnect();
}
main().catch(console.error);
