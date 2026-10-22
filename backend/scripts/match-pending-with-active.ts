import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const active = await prisma.ingredient.findMany({
    where: { isActive: true, imageUrl: { not: null } },
    select: { id: true, code: true, name: true, imageUrl: true }
  });

  const pending = await prisma.ingredient.findMany({
    where: { status: 'PENDING_REVIEW' },
    select: { id: true, code: true, name: true, imageUrl: true }
  });

  console.log(`Active có ảnh: ${active.length}, Pending: ${pending.length}`);

  let matchCount = 0;
  for (const p of pending) {
    const pName = p.name.toLowerCase().trim();
    // Tìm trong active xem có trùng hoặc bao hàm không
    const match = active.find(a => {
      const aName = a.name.toLowerCase().trim();
      return aName === pName || pName.includes(aName) || aName.includes(pName);
    });

    if (match) {
      matchCount++;
      console.log(`🎯 Pending: "${p.name}" <---> Active: "${match.name}" (${match.imageUrl?.slice(0, 60)}...)`);
    } else {
      console.log(`❓ Pending chưa có trong active: "${p.name}"`);
    }
  }

  console.log(`\nTổng số match: ${matchCount}/${pending.length}`);
}

main().catch(console.error);
