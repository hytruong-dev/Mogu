import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

async function checkMedia() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });
  const dishes = await prisma.dish.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      media: { select: { id: true, sourceUrl: true, storageKey: true, isPrimary: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 35
  });
  console.log('Total dishes:', dishes.length);
  dishes.forEach((d, i) => {
    console.log(`${i + 1}. ${d.name} [ID: ${d.id}] -> media: ${d.media.length ? d.media.map(m => m.sourceUrl || m.storageKey).join(', ') : 'NO MEDIA'}`);
  });
  await prisma.$disconnect();
}
checkMedia().catch(console.error);
