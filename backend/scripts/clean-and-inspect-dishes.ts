import * as path from 'path';
import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const dishes = await prisma.dish.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        status: true,
        media: {
          select: {
            id: true,
            storageKey: true,
            sourceUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`Current active dishes in DB: ${dishes.length}`);
    for (const d of dishes) {
      console.log(`- ${d.name} (${d.status}) | Media count: ${d.media.length} | id: ${d.id}`);
    }
  } finally {
    process.exit(0);
  }
}

main().catch(console.error);
