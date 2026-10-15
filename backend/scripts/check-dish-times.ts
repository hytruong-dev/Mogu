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

  const dishes = await prisma.dish.findMany({
    select: { id: true, name: true, createdAt: true, status: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`Dishes count: ${dishes.length}`);
  console.log('First 3:', dishes.slice(0, 3));
  console.log('Last 3:', dishes.slice(-3));

  await prisma.$disconnect();
  await pool.end();
}
main().catch(console.error);
