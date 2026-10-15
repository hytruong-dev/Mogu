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
  const prisma = new PrismaClient({ adapter } as any);
  try {
    const jobs = await prisma.importJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        query: true,
        status: true,
        suggestedImageUrl: true,
        warnings: true,
        currentStepName: true,
        currentStepMessage: true,
        createdAt: true,
      },
    });
    console.log('Latest jobs:', JSON.stringify(jobs, null, 2));

    const dishes = await prisma.dish.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        status: true,
        media: {
          select: {
            id: true,
            storageKey: true,
            sourceUrl: true,
            moderationStatus: true,
          },
        },
      },
    });
    console.log('Latest dishes:', JSON.stringify(dishes, null, 2));

    const totalDishes = await prisma.dish.count({ where: { deletedAt: null } });
    console.log('Total dishes in DB now:', totalDishes);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
main().catch(console.error);
