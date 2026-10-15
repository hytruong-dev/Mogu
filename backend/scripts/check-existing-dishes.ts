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
    const roles: any[] = await prisma.$queryRaw`
      SELECT pr.role, p.user_id, p.display_name 
      FROM profile_roles pr 
      JOIN profiles p ON pr.profile_id = p.id 
      LIMIT 5
    `;
    console.log('Roles:', roles);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
main().catch(console.error);
