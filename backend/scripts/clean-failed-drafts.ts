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
    // Find dishes with 0 media or test dishes of Hủ tiếu Nam Vang
    const dishesToDelete = await prisma.dish.findMany({
      where: {
        OR: [
          { media: { none: {} } },
          { name: 'Hủ tiếu Nam Vang' },
        ],
      },
      select: { id: true, name: true },
    });

    console.log(`Found ${dishesToDelete.length} draft/test dishes to clean up:`);
    for (const d of dishesToDelete) {
      console.log(`- Deleting: ${d.name} (${d.id})`);
      // Update any importJob resultDishId to null first
      await prisma.importJob.updateMany({
        where: { resultDishId: d.id },
        data: { resultDishId: null },
      });
      await prisma.dish.delete({ where: { id: d.id } });
    }
    console.log('✅ Cleanup completed successfully.');
  } finally {
    process.exit(0);
  }
}

main().catch(console.error);
