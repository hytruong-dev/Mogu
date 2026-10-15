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
    const regions = await prisma.region.findMany();
    console.log('Regions:', regions);
    const sgProvince = await prisma.province.findFirst({
      where: { name: { contains: 'Hồ Chí Minh' } }
    });
    console.log('TP.HCM Province:', sgProvince);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
main().catch(console.error);
