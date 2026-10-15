import * as path from 'path';
import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    const inactives = await prisma.ingredient.findMany({
      where: { isActive: false },
      select: {
        id: true,
        code: true,
        name: true,
        nameEn: true,
        groupLabel: true,
        imageUrl: true,
        status: true,
      },
      orderBy: { name: 'asc' },
    });

    console.log(`Found ${inactives.length} inactive ingredients:`);
    inactives.forEach((item, idx) => {
      console.log(`${idx + 1}. [${item.id}] ${item.name} (${item.groupLabel || 'N/A'}) - current: ${item.imageUrl}`);
    });
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
