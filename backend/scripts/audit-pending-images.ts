import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const pending = await prisma.ingredient.findMany({
    where: { status: 'PENDING_REVIEW' },
    select: {
      id: true,
      code: true,
      name: true,
      groupLabel: true,
      imageUrl: true,
      imageStatus: true
    },
    orderBy: { name: 'asc' }
  });

  console.log(`Tìm thấy ${pending.length} nguyên liệu PENDING_REVIEW:`);
  for (const item of pending) {
    console.log(`- [${item.code}] "${item.name}" (${item.groupLabel || 'Chưa phân nhóm'}): ${item.imageUrl || 'Chưa có ảnh'}`);
  }
}

main().catch(console.error);
