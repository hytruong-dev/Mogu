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
    include: {
      region: true,
      dishes: {
        where: { deletedAt: null },
        select: { id: true, name: true, status: true }
      }
    },
    orderBy: [
      { region: { code: 'asc' } },
      { name: 'asc' }
    ]
  });

  console.log(`=== ĐỐI SOÁT TOÀN BỘ TỈNH THÀNH VỚI MÓN ĂN TRONG DATABASE ===\n`);

  const covered: any[] = [];
  const missing: any[] = [];

  provinces.forEach(p => {
    if (p.dishes.length > 0) {
      covered.push({
        id: p.id,
        code: p.code,
        name: p.name,
        region: p.region.name,
        dishes: p.dishes.map(d => d.name)
      });
    } else {
      missing.push({
        id: p.id,
        code: p.code,
        name: p.name,
        regionCode: p.region.code,
        region: p.region.name
      });
    }
  });

  console.log(`✅ Các tỉnh thành ĐÃ CÓ món đặc sản trong DB (${covered.length} tỉnh thành):`);
  covered.forEach((c, idx) => {
    console.log(`${idx + 1}. [${c.code}] ${c.name} (${c.region}) -> ${c.dishes.join(', ')}`);
  });

  console.log(`\n❌ Các tỉnh thành CHƯA CÓ món ăn trong DB (${missing.length} tỉnh thành):`);
  missing.forEach((m, idx) => {
    console.log(`${idx + 1}. [${m.code}] ${m.name} (${m.region})`);
  });
}

main().finally(() => prisma.$disconnect());
