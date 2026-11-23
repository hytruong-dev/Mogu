import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const provinces = await prisma.province.findMany({
    orderBy: { name: 'asc' },
    include: {
      dishes: {
        where: { deletedAt: null },
        include: {
          media: {
            where: { isPrimary: true },
          },
        },
      },
    },
  });

  console.log(`Total provinces: ${provinces.length}`);
  const missingDishes: string[] = [];
  const missingImages: string[] = [];

  provinces.forEach(p => {
    if (p.dishes.length === 0) {
      missingDishes.push(p.name);
    } else {
      const hasImage = p.dishes.some(d => d.media.length > 0 && d.media[0].storageKey);
      if (!hasImage) {
        missingImages.push(`${p.name}: ${p.dishes[0].name}`);
      }
    }
  });

  console.log(`Provinces missing dishes: ${missingDishes.length}`);
  if (missingDishes.length > 0) console.log(missingDishes);

  console.log(`Provinces with dishes missing images: ${missingImages.length}`);
  if (missingImages.length > 0) console.log(missingImages);
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});
