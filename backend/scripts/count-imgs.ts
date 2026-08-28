import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
dotenv.config({ path: '.env.local' });

async function main() {
  const pool = new (pg.Pool)({ connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter } as any) as any;
  const total = await db.ingredient.count();
  const withImg = await db.ingredient.count({ where: { imageUrl: { not: null } } });
  const withNewCode = await db.ingredient.count({ where: { code: { startsWith: 'ING-' } } });
  console.log(`Total: ${total}`);
  console.log(`With image: ${withImg}`);
  console.log(`With ING- code: ${withNewCode}`);
  await db.$disconnect(); await pool.end();
}
main().catch(console.error);
