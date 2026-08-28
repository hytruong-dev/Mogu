/**
 * Seed Goals vào DB qua Prisma với PrismaPg adapter
 * Usage: npx tsx scripts/seed-goals-prisma.ts
 */
import * as fs from 'fs';
import * as path from 'path';

// Load env từ .env.local
const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
envFile.split('\n').forEach((line) => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length) process.env[key.trim()] = vals.join('=').trim();
});

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

const GOALS = [
  { code: 'BALANCE',      name: 'Cân bằng',     description: 'Duy trì chế độ ăn cân bằng, đa dạng dinh dưỡng', displayOrder: 1, active: true },
  { code: 'LOSE_WEIGHT',  name: 'Giảm cân',     description: 'Ưu tiên món ít calo, nhiều chất xơ',              displayOrder: 2, active: true },
  { code: 'BUILD_MUSCLE', name: 'Tăng cơ',      description: 'Món giàu protein, hỗ trợ tăng cơ bắp',           displayOrder: 3, active: true },
  { code: 'EAT_HEALTHY',  name: 'Ăn lành mạnh', description: 'Ưu tiên thực phẩm sạch, ít chế biến',            displayOrder: 4, active: true },
  { code: 'SAVE_MONEY',   name: 'Tiết kiệm',    description: 'Món ngon, giá cả phải chăng',                     displayOrder: 5, active: true },
  { code: 'EXPLORE',      name: 'Khám phá',     description: 'Thử những món mới, đa dạng vùng miền',            displayOrder: 6, active: true },
];

async function main() {
  console.log('🌱 Seeding Goals...\n');

  for (const goal of GOALS) {
    const result = await (prisma as any).goal.upsert({
      where: { code: goal.code },
      update: {
        name: goal.name,
        description: goal.description,
        displayOrder: goal.displayOrder,
        active: goal.active,
      },
      create: goal,
    });
    console.log(`  ✅ ${result.name} (${result.code})`);
  }

  const all = await (prisma as any).goal.findMany({ orderBy: { displayOrder: 'asc' } });
  console.log('\n📋 Goals trong DB:');
  console.table(
    all.map((g: any) => ({
      code: g.code,
      name: g.name,
      order: g.displayOrder,
      active: g.active,
    })),
  );
}

main()
  .catch(console.error)
  .finally(() => (prisma as any).$disconnect());
