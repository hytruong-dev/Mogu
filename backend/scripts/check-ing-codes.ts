import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
dotenv.config({ path: '.env.local' });

async function main() {
  const pool = new (pg.Pool)({ connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter } as any) as any;

  const sample = await db.ingredient.findMany({ take: 8, select: { code: true, name: true, imageUrl: true } });
  console.log('Sample ingredients:');
  for (const s of sample) console.log(`  code=${s.code}  name=${s.name}  hasImg=${!!s.imageUrl}`);
  const total = await db.ingredient.count();
  console.log('Total:', total);
  await db.$disconnect(); await pool.end();
}
main().catch(console.error);
