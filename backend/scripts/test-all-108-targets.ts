import { mapRawToTarget } from './prepare-provision-plan';
import { resolveImageForIngredient } from './resolve-all-pending-images';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  const unlinked = await prisma.dishIngredient.findMany({
    where: { ingredientId: null },
    select: { rawText: true, parsedName: true },
  });

  const uniqueTargets = new Map<string, ReturnType<typeof mapRawToTarget>>();
  for (const u of unlinked) {
    const t = mapRawToTarget(u.rawText, u.parsedName);
    uniqueTargets.set(t.name.toLowerCase(), t);
  }

  // Also include 9 existing pending
  const existingPending = await prisma.ingredient.findMany({
    where: { status: 'PENDING_REVIEW' },
    select: { name: true },
  });
  for (const ep of existingPending) {
    if (!uniqueTargets.has(ep.name.toLowerCase())) {
      uniqueTargets.set(ep.name.toLowerCase(), { name: ep.name, groupLabel: 'Khác', unit: 'g' });
    }
  }

  console.log(`Total unique items to resolve: ${uniqueTargets.size}`);
  const unres: string[] = [];
  let resolvedCount = 0;

  for (const [key, t] of uniqueTargets.entries()) {
    const res = await resolveImageForIngredient(t.name);
    if (res?.url) {
      resolvedCount++;
    } else {
      unres.push(t.name);
    }
  }

  console.log(`Resolved: ${resolvedCount} / ${uniqueTargets.size}`);
  if (unres.length > 0) {
    console.log(`Unresolved items (${unres.length}):`, unres);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
