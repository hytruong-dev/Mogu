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
    const count = await prisma.ingredient.count();
    console.log('Total ingredients count:', count);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
main().catch(console.error);
