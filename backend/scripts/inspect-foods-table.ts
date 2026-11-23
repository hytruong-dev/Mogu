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
  const foods = await prisma.food.findMany();
  console.log(`=== BẢNG FOODS (Master Food Catalogue) ===`);
  console.log(`Tổng số món trong bảng foods: ${foods.length}`);

  const withImg = foods.filter(f => !!f.imageUrl);
  const withoutImg = foods.filter(f => !f.imageUrl);

  console.log(`- Có imageUrl: ${withImg.length}`);
  console.log(`- KHÔNG CÓ imageUrl: ${withoutImg.length}`);

  if (withoutImg.length > 0) {
    console.log('Mẫu các món thiếu ảnh trong bảng foods:');
    withoutImg.slice(0, 10).forEach(f => console.log(`  - [${f.id}] "${f.name}"`));
  }
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});
