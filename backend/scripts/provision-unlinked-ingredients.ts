import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { mapRawToTarget } from './prepare-provision-plan';
import { resolveImageForIngredient } from './resolve-all-pending-images';

function generateShortId(length = 5): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let res = '';
  for (let i = 0; i < length; i++) {
    res += chars[Math.floor(Math.random() * chars.length)];
  }
  return res;
}

function normalizeIdentity(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  console.log('🚀 Starting provisioning of unlinked dish ingredients & pending ingredient images...\n');

  // 1. Process existing PENDING_REVIEW ingredients first (assign images if null)
  const existingPending = await prisma.ingredient.findMany({
    where: { status: 'PENDING_REVIEW' },
  });
  console.log(`Found ${existingPending.length} existing PENDING_REVIEW ingredients.`);
  for (const ep of existingPending) {
    if (!ep.imageUrl) {
      const resolved = await resolveImageForIngredient(ep.name);
      if (resolved) {
        await prisma.ingredient.update({
          where: { id: ep.id },
          data: {
            imageUrl: resolved.url,
            imageStatus: 'PENDING_REVIEW',
          },
        });
        console.log(`📸 Updated image for existing pending "${ep.name}" (${ep.code}) -> [${resolved.source}]`);
      } else {
        console.warn(`⚠️ Could not find image for "${ep.name}"`);
      }
    }
  }

  // 2. Load all master ingredients into lookup maps
  const allIngredients = await prisma.ingredient.findMany({
    select: { id: true, code: true, name: true, identityNormalized: true, status: true, imageUrl: true },
  });
  const ingByIdentity = new Map<string, typeof allIngredients[0]>();
  const ingByName = new Map<string, typeof allIngredients[0]>();

  for (const ing of allIngredients) {
    ingByIdentity.set(ing.identityNormalized, ing);
    ingByName.set(ing.name.toLowerCase().trim(), ing);
  }

  // 3. Find all unlinked dish ingredients
  const unlinkedDishIngs = await prisma.dishIngredient.findMany({
    where: { ingredientId: null },
    include: {
      dish: { select: { id: true, name: true } },
    },
    orderBy: { dish: { name: 'asc' } },
  });

  console.log(`\nFound ${unlinkedDishIngs.length} unlinked dish ingredient records across dishes.\n`);

  let provisionedNewCount = 0;
  let linkedExistingCount = 0;

  for (const u of unlinkedDishIngs) {
    const target = mapRawToTarget(u.rawText, u.parsedName);
    const identity = normalizeIdentity(target.name);
    const lowerName = target.name.toLowerCase().trim();

    // Check if ingredient exists
    let match = ingByIdentity.get(identity) || ingByName.get(lowerName);

    if (!match) {
      // Create new ingredient with status = PENDING_REVIEW
      const code = `${identity}-${generateShortId()}`;
      const searchFolded = target.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/gi, 'd')
        .toLowerCase();

      // Resolve image
      const resolved = await resolveImageForIngredient(target.name);
      const imageUrl = resolved?.url || null;

      const created = await prisma.ingredient.create({
        data: {
          code,
          name: target.name,
          identityNormalized: identity,
          searchFolded,
          groupLabel: target.groupLabel,
          unit: target.unit,
          allergenCode: target.allergenCode || null,
          status: 'PENDING_REVIEW',
          isActive: false,
          createdVia: 'ADMIN_PICKER',
          imageUrl,
          imageStatus: 'PENDING_REVIEW',
        },
      });

      match = created;
      ingByIdentity.set(identity, created);
      ingByName.set(lowerName, created);
      provisionedNewCount++;
      console.log(`✨ Provisioned new PENDING ingredient [${created.code}] "${created.name}" (Group: ${target.groupLabel}, Image: ${imageUrl ? 'YES' : 'NO'})`);
    } else {
      // If matched ingredient doesn't have an image, give it one
      if (!match.imageUrl) {
        const resolved = await resolveImageForIngredient(match.name);
        if (resolved) {
          await prisma.ingredient.update({
            where: { id: match.id },
            data: {
              imageUrl: resolved.url,
              imageStatus: 'PENDING_REVIEW',
            },
          });
          match.imageUrl = resolved.url;
          console.log(`📸 Added missing image to matched ingredient "${match.name}"`);
        }
      }
    }

    // Link dish ingredient to the matched or newly created ingredient
    await prisma.dishIngredient.update({
      where: { id: u.id },
      data: {
        ingredientId: match.id,
        parsedName: target.name,
        needsReview: false, // Dish ingredient is now linked to a provisioned catalog item
      },
    });

    linkedExistingCount++;
  }

  console.log(`\n═══════════════════════════════════════════════════════════════════`);
  console.log(`🎉 PROVISIONING SUMMARY:`);
  console.log(`- Newly created PENDING_REVIEW ingredients: ${provisionedNewCount}`);
  console.log(`- Total dish ingredient records linked: ${linkedExistingCount}`);

  // 4. Verification audit
  const finalPending = await prisma.ingredient.findMany({
    where: { status: 'PENDING_REVIEW' },
    select: { id: true, code: true, name: true, imageUrl: true, createdVia: true },
  });
  const remainingUnlinked = await prisma.dishIngredient.count({
    where: { ingredientId: null },
  });
  const pendingWithoutImage = finalPending.filter((p) => !p.imageUrl);

  console.log(`\n📊 VERIFICATION:`);
  console.log(`- Total ingredients in "Cần duyệt" (PENDING_REVIEW): ${finalPending.length}`);
  console.log(`- Pending ingredients WITH images: ${finalPending.length - pendingWithoutImage.length} / ${finalPending.length}`);
  console.log(`- Pending ingredients WITHOUT images: ${pendingWithoutImage.length}`);
  console.log(`- Remaining unlinked dish ingredients: ${remainingUnlinked}`);

  if (pendingWithoutImage.length > 0) {
    console.log(`\nItems needing image fallbacks:`);
    for (const p of pendingWithoutImage) {
      console.log(`- [${p.code}] "${p.name}"`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
