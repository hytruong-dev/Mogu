import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

  // 1. Unlinked dish ingredients
  const unlinkedDishIngs = await prisma.dishIngredient.findMany({
    where: { ingredientId: null },
    include: { dish: { select: { id: true, name: true } } },
  });

  console.log(`=== 1. UNLINKED DISH INGREDIENTS (ingredientId IS NULL) ===`);
  console.log(`Total: ${unlinkedDishIngs.length}`);
  const unlinkedGrouped = new Map<string, string[]>();
  for (const di of unlinkedDishIngs) {
    const raw = di.rawText.trim();
    if (!unlinkedGrouped.has(raw)) unlinkedGrouped.set(raw, []);
    unlinkedGrouped.get(raw)!.push(di.dish.name);
  }
  for (const [raw, dishes] of unlinkedGrouped.entries()) {
    console.log(`- "${raw}" (in ${dishes.length} dishes: ${dishes.slice(0, 3).join(', ')})`);
  }

  // 2. Ingredients in master table with PENDING_REVIEW
  const pendingIngs = await prisma.ingredient.findMany({
    where: { status: 'PENDING_REVIEW' },
    select: { id: true, code: true, name: true, createdVia: true, imageUrl: true },
  });
  console.log(`\n=== 2. MASTER INGREDIENTS WITH status = PENDING_REVIEW ===`);
  console.log(`Total: ${pendingIngs.length}`);
  console.log(`Pending without image: ${pendingIngs.filter(i => !i.imageUrl).length}`);
  for (const pi of pendingIngs) {
    console.log(`- [${pi.code}] "${pi.name}" (createdVia: ${pi.createdVia}, hasImage: ${!!pi.imageUrl})`);
  }

  // 3. Total ingredients in DB
  const totalIngs = await prisma.ingredient.count();
  const withoutImage = await prisma.ingredient.count({ where: { imageUrl: null } });
  console.log(`\n=== 3. OVERALL INGREDIENT STATS ===`);
  console.log(`Total master ingredients: ${totalIngs}`);
  console.log(`Ingredients without image: ${withoutImage}`);

  await prisma.$disconnect();
}

main().catch(console.error);
