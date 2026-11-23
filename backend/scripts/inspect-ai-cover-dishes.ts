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
  const dishes = await prisma.dish.findMany({
    where: {
      deletedAt: null,
      media: {
        some: {
          storageKey: { contains: 'ai-cover-' },
        },
      },
    },
    include: {
      media: true,
      province: true,
    },
  });

  console.log(`Số món có storageKey chứa ai-cover-: ${dishes.length}`);
  dishes.forEach((d, i) => {
    const m = d.media[0];
    console.log(`${i + 1}. [${d.name}] (${d.province?.name}) - sizeBytes: ${m?.sizeBytes} - mimeType: ${m?.mimeType} - credit: ${m?.credit}`);
  });
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});
