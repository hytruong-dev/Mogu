import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const dishes = await prisma.dish.findMany({
    where: {
      deletedAt: null,
      media: {
        some: {
          OR: [
            { sourceUrl: null },
            { sourceUrl: '' },
          ],
        },
      },
    },
    include: {
      media: true,
      province: true,
    },
  });

  console.log(`Số món có sourceUrl rỗng/null: ${dishes.length}`);

  let storageExistsCount = 0;
  let storageMissingCount = 0;

  for (const d of dishes) {
    const m = d.media[0];
    const bucket = m.bucket || 'dish-images';
    const key = m.storageKey;

    // Check if file exists in Supabase Storage
    const { data, error } = await supabase.storage.from(bucket).list(path.dirname(key));
    const fileName = path.basename(key);
    const exists = data?.some(f => f.name === fileName);

    console.log(`- [${d.name}] (${d.province?.name}): bucket=${bucket}, key=${key}, existsInStorage=${exists}`);
    if (exists) storageExistsCount++;
    else storageMissingCount++;
  }

  console.log(`\nTổng kết:`);
  console.log(`- Tồn tại trên Supabase Storage: ${storageExistsCount}`);
  console.log(`- THIẾU trên Supabase Storage: ${storageMissingCount}`);
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});
