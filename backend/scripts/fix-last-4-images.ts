import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const FIXES: Record<string, string> = {
  'Sợi mì Cao lầu tươi': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
  'Nước mạ lòng mề gà': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
  'Đu đủ chua ngâm giòn': 'https://cdn.tgdd.vn/Files/2021/08/18/1376041/cach-lam-du-du-ngam-chua-ngot-gion-ngon-chong-ngan-cho-bua-an-202108181358393529.jpg',
  'Nước luộc gà': 'https://images.unsplash.com/photo-1604152135912-04a022e23696?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=400',
};

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  for (const [name, url] of Object.entries(FIXES)) {
    const updated = await prisma.ingredient.updateMany({
      where: { name, imageUrl: null },
      data: {
        imageUrl: url,
        imageStatus: 'PENDING_REVIEW',
      },
    });
    console.log(`Updated "${name}": ${updated.count} record(s)`);
  }

  // Verification
  const totalPending = await prisma.ingredient.count({ where: { status: 'PENDING_REVIEW' } });
  const pendingWithImage = await prisma.ingredient.count({
    where: { status: 'PENDING_REVIEW', imageUrl: { not: null } },
  });
  const unlinkedDishIngs = await prisma.dishIngredient.count({ where: { ingredientId: null } });

  console.log(`\n🎉 FINAL AUDIT REPORT:`);
  console.log(`- Total PENDING_REVIEW ingredients in Admin "Cần duyệt": ${totalPending}`);
  console.log(`- PENDING_REVIEW ingredients with valid image: ${pendingWithImage} / ${totalPending} (${Math.round((pendingWithImage / totalPending) * 100)}%)`);
  console.log(`- Unlinked dish ingredients remaining across all 60 dishes: ${unlinkedDishIngs}`);

  await prisma.$disconnect();
}

main().catch(console.error);
