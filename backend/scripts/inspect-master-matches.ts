import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

  const allActive = await prisma.ingredient.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, code: true, name: true, imageUrl: true },
  });
  console.log(`Total active ingredients in DB: ${allActive.length}`);

  const activeByName = new Map<string, typeof allActive[0]>();
  for (const a of allActive) {
    activeByName.set(a.name.toLowerCase().trim(), a);
  }

  // Check some names
  const testNames = [
    'Thịt ba chỉ', 'Gan heo', 'Tỏi phi', 'Thịt xá xíu', 'Nước mắm', 'Đậu phụ rán', 
    'Lạc rang', 'Quế thanh', 'Hành khô', 'Hành lá', 'Gia vị', 'Măng chua'
  ];

  for (const t of testNames) {
    const match = activeByName.get(t.toLowerCase());
    console.log(`- "${t}": ${match ? `FOUND (${match.code}, hasImage: ${!!match.imageUrl})` : 'NOT FOUND'}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
