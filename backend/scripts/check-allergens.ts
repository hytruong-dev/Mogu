import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
dotenv.config({ path: '.env.local' });

async function main() {
  const pool = new (pg.Pool)({ connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter } as any) as any;
  const rows = await db.allergen.findMany({ orderBy: { code: 'asc' } });
  console.log(`Allergen count: ${rows.length}`);
  for (const r of rows) console.log(` ${r.code.padEnd(12)} ${r.name}`);
  await db.$disconnect();
  await pool.end();
}
main().catch(console.error);
