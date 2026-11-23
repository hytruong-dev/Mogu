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
  const dishes = await prisma.dish.findMany({
    where: { deletedAt: null },
    include: {
      media: { where: { isPrimary: true } },
    },
    orderBy: { name: 'asc' },
  });

  console.log(`Checking HTTP accessibility for all ${dishes.length} dishes...`);

  const failed: { name: string; url: string; status: number | string }[] = [];
  const ok: string[] = [];

  for (const d of dishes) {
    const m = d.media[0];
    if (!m || !m.storageKey) {
      failed.push({ name: d.name, url: 'NO_MEDIA', status: 'MISSING' });
      continue;
    }

    const bucket = m.bucket || 'dish-images';
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${m.storageKey}`;

    try {
      const res = await fetch(publicUrl, { method: 'HEAD' });
      if (res.ok) {
        ok.push(d.name);
      } else {
        failed.push({ name: d.name, url: publicUrl, status: res.status });
      }
    } catch (e: any) {
      failed.push({ name: d.name, url: publicUrl, status: e.message });
    }
  }

  console.log(`\n=== KẾT QUẢ KIỂM TRA HTTP ẢNH ĐẠI DIỆN ===`);
  console.log(`- Thành công (200 OK): ${ok.length}`);
  console.log(`- Thất bại / Lỗi (404/Error): ${failed.length}`);

  if (failed.length > 0) {
    console.log('\nDanh sách các món bị lỗi ảnh:');
    failed.forEach(f => console.log(`❌ [${f.name}]: ${f.status} -> ${f.url}`));
  }
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});
