import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lkqvyvllmrbxgaoqrkhd.supabase.co';

async function main() {
  const allMedia = await prisma.dishMedia.findMany({
    where: {
      OR: [
        { sourceUrl: null },
        { sourceUrl: '' },
      ],
    },
  });

  console.log(`Cập nhật sourceUrl cho ${allMedia.length} bản ghi dish_media...`);

  let updated = 0;
  for (const m of allMedia) {
    if (m.storageKey) {
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${m.bucket}/${m.storageKey}`;
      await prisma.dishMedia.update({
        where: { id: m.id },
        data: { sourceUrl: publicUrl },
      });
      updated++;
    }
  }

  console.log(`Đã cập nhật ${updated} bản ghi sourceUrl thành công!`);
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});
