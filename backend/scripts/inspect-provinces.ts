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
  const regions = await prisma.region.findMany({
    include: {
      provinces: {
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  const allProvinces = await prisma.province.findMany({
    include: { region: true },
    orderBy: { name: 'asc' },
  });

  console.log(`=== DANH SÁCH VÙNG MIỀN VÀ TỈNH THÀNH TRONG DATABASE ===`);
  console.log(`Tổng số vùng miền (Regions): ${regions.length}`);
  console.log(`Tổng số tỉnh thành (Provinces): ${allProvinces.length}`);

  regions.forEach(r => {
    console.log(`\n📍 Vùng [${r.code}] ${r.name} (${r.provinces.length} tỉnh thành):`);
    r.provinces.forEach((p, idx) => {
      console.log(`   ${idx + 1}. [${p.code}] ${p.name}`);
    });
  });

  // Check how many dishes currently have provinceId set
  const dishesWithProvince = await prisma.dish.findMany({
    where: { provinceId: { not: null }, deletedAt: null },
    include: { province: true, region: true },
  });
  console.log(`\n🍽️ Số món ăn đã được gán tỉnh thành trong DB: ${dishesWithProvince.length}`);
  dishesWithProvince.forEach(d => {
    console.log(`   - ${d.name} -> ${d.province?.name} (${d.region?.name})`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
