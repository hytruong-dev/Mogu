import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const active = await prisma.ingredient.findMany({
    where: { isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      groupLabel: true,
      imageUrl: true,
      synonyms: true
    },
    orderBy: { name: 'asc' }
  });

  console.log(`Tìm thấy ${active.length} nguyên liệu active`);
  const outPath = path.join(__dirname, 'active-ingredients-full.json');
  fs.writeFileSync(outPath, JSON.stringify(active, null, 2), 'utf8');
  console.log(`Đã ghi vào ${outPath}`);
}

main().catch(console.error);
