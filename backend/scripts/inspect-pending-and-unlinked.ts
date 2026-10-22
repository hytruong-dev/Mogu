import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

  const pending = await prisma.ingredient.findMany({
    where: { status: 'PENDING_REVIEW' },
    include: {
      dishIngredients: {
        select: {
          id: true,
          dish: { select: { id: true, name: true } },
        },
      },
    },
  });

  console.log(`\n=== CURRENT PENDING_REVIEW INGREDIENTS (${pending.length}) ===`);
  for (const p of pending) {
    console.log(`- [${p.code}] "${p.name}" (imageUrl: ${p.imageUrl || 'NULL'}, dishes: ${p.dishIngredients.map(d => d.dish.name).join(', ') || 'NONE'})`);
  }

  const unlinked = await prisma.dishIngredient.findMany({
    where: { ingredientId: null },
    include: {
      dish: { select: { id: true, name: true } },
    },
  });
  console.log(`\n=== TOTAL UNLINKED DISH INGREDIENTS: ${unlinked.length} ===`);

  // Let's see how many dishes have unlinked ingredients
  const dishesWithUnlinked = new Set(unlinked.map(u => u.dish.name));
  console.log(`Dishes with unlinked ingredients: ${dishesWithUnlinked.size}`);

  const lauEch = await prisma.dish.findFirst({
    where: { name: { contains: 'Lẩu ếch măng cay' } },
    include: {
      dishIngredients: {
        include: { ingredient: true }
      }
    }
  });
  console.log(`\n=== LẨU ẾCH MĂNG CAY INGREDIENTS ===`);
  lauEch?.dishIngredients.forEach(di => {
    console.log(`- "${di.rawText}" | parsed: "${di.parsedName}" | ing: "${di.ingredient?.name}" | status: ${di.ingredient?.status} | needsReview: ${di.needsReview}`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);
