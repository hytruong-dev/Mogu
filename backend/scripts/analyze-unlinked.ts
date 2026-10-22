import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

  const unlinked = await prisma.dishIngredient.findMany({
    where: { ingredientId: null },
    select: {
      id: true,
      rawText: true,
      parsedName: true,
      unit: true,
      dish: { select: { id: true, name: true } },
    },
  });

  console.log(`Total unlinked dish ingredient instances: ${unlinked.length}`);

  // Also check existing ingredients in DB to see if any can be matched by name
  const allMaster = await prisma.ingredient.findMany({
    select: { id: true, name: true, identityNormalized: true, status: true, imageUrl: true },
  });

  const masterByName = new Map<string, typeof allMaster[0]>();
  for (const m of allMaster) {
    masterByName.set(m.name.toLowerCase().trim(), m);
  }

  const needsProvisioning = new Map<string, { rawText: string; cleanName: string; unit: string; dishes: string[] }>();
  let canDirectLinkCount = 0;

  for (const u of unlinked) {
    const raw = u.rawText.trim();
    const clean = (u.parsedName || raw).replace(/^\d+[\d.,/-]*\s*(g|kg|ml|l|thìa|muỗng|chén|bát|tô|cái|quả|trái|củ|nhánh|lá|miếng|gói|phần)?\s*/i, '').trim();
    
    // Check if clean exists in master
    const match = masterByName.get(clean.toLowerCase());
    if (match) {
      canDirectLinkCount++;
    } else {
      const key = clean.toLowerCase();
      if (!needsProvisioning.has(key)) {
        needsProvisioning.set(key, { rawText: raw, cleanName: clean, unit: u.unit || 'g', dishes: [] });
      }
      needsProvisioning.get(key)!.dishes.push(u.dish.name);
    }
  }

  console.log(`Can direct link to existing master ingredients: ${canDirectLinkCount}`);
  console.log(`Unique ingredients that need provisioning into "Cần duyệt": ${needsProvisioning.size}`);
  
  let i = 1;
  for (const [key, item] of needsProvisioning.entries()) {
    console.log(`${i++}. "${item.cleanName}" (từ "${item.rawText}") [${item.dishes.length} món: ${item.dishes.slice(0, 2).join(', ')}]`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
