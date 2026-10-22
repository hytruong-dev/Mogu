import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  const pending = await prisma.ingredient.findMany({
    where: { status: 'PENDING_REVIEW' },
    select: { id: true, code: true, name: true, groupLabel: true, imageUrl: true },
    orderBy: { name: 'asc' },
  });

  console.log(`Total PENDING_REVIEW ingredients: ${pending.length}`);
  const lines: string[] = [];
  for (let i = 0; i < pending.length; i++) {
    const p = pending[i];
    lines.push(`${i + 1}. [${p.code}] "${p.name}" (${p.groupLabel})\n   Image: ${p.imageUrl || 'NULL'}`);
  }

  const outPath = path.join(__dirname, 'all-pending-audit.txt');
  fs.writeFileSync(outPath, lines.join('\n\n'), 'utf-8');
  console.log(`Saved audit list to ${outPath}`);

  await prisma.$disconnect();
}

main().catch(console.error);
