import * as path from 'path';
import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);
  
  const dishes = await prisma.dish.findMany({
    where: { deletedAt: null },
    include: {
      media: true,
      mealTypes: { include: { mealTypeTag: true } },
      categories: { include: { category: true } },
    },
    take: 15,
  });

  for (const d of dishes) {
    console.log(`\n=== ${d.name} ===`);
    console.log('Meal types:', d.mealTypes.map((m: any) => m.mealTypeTag.name || m.mealTypeTag.code));
    console.log('Media:', d.media.map((m: any) => ({ url: m.sourceUrl, alt: m.altText })));
  }

  await prisma.$disconnect();
  await pool.end();
}
main().catch(console.error);
