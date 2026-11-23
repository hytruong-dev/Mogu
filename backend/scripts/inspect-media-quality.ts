import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const media = await prisma.dishMedia.findMany({
    select: {
      id: true,
      dishId: true,
      storageKey: true,
      bucket: true,
      mimeType: true,
      isPrimary: true,
      moderationStatus: true,
    },
  });

  console.log(`Total dishMedia records: ${media.length}`);
  const approved = media.filter(m => m.moderationStatus === 'APPROVED');
  const pending = media.filter(m => m.moderationStatus === 'PENDING');
  const rejected = media.filter(m => m.moderationStatus === 'REJECTED');
  const noStorageKey = media.filter(m => !m.storageKey);

  console.log(`Approved: ${approved.length}, Pending: ${pending.length}, Rejected: ${rejected.length}`);
  console.log(`Missing storageKey: ${noStorageKey.length}`);

  // Print first 5 sample storage keys
  console.log('Sample storage keys:');
  media.slice(0, 5).forEach(m => console.log(`- ${m.storageKey} (${m.bucket})`));
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});
