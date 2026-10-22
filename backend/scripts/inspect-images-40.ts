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
  const pending = await prisma.ingredient.findMany({
    where: { status: 'PENDING_REVIEW' },
    select: {
      code: true,
      name: true,
      groupLabel: true,
      imageUrl: true,
    },
    orderBy: { name: 'asc' }
  });

  console.log(`Kiểm tra ảnh của ${pending.length} nguyên liệu pending:\n`);
  for (const item of pending) {
    console.log(`[${item.code}] "${item.name}"`);
    console.log(`  -> URL: ${item.imageUrl || 'CHƯA CÓ ẢNH'}`);
  }
}

main().finally(() => prisma.$disconnect());
