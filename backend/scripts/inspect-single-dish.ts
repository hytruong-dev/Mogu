import * as path from 'path';
import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

async function check() {
  const pool = new pg.Pool({ connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const dish = await prisma.dish.findUnique({
    where: { id: 'c9797626-1cb4-49e0-911c-e3557518e934' },
    include: {
      media: true,
      mealTypes: { include: { mealTypeTag: true } },
    },
  });

  console.log('Dish Name:', dish?.name);
  console.log('Servings:', dish?.servings);
  console.log('Media count:', dish?.media?.length);
  console.log('Media:', dish?.media);
  console.log('Meal types:', dish?.mealTypes?.map((m: any) => m.mealTypeTag.name));
  process.exit(0);
}
check();
