import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  
  // Lấy tài khoản admin
  const admins = await prisma.$queryRaw<Array<{ user_id: string }>>`
    SELECT p.user_id
    FROM profile_roles pr
    JOIN profiles p ON p.id = pr.profile_id
    WHERE pr.role::text = 'SUPER_ADMIN'
    LIMIT 1
  `;
  const adminUserId = admins[0]?.user_id ?? null;

  const drafts = await prisma.dish.findMany({
    where: { status: 'DRAFT', deletedAt: null },
    select: { id: true, name: true },
  });

  console.log(`Tìm thấy ${drafts.length} món đang ở trạng thái DRAFT:`, drafts.map(d => d.name));

  if (drafts.length > 0) {
    for (const d of drafts) {
      await prisma.dish.update({
        where: { id: d.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          reviewedAt: new Date(),
          reviewedBy: adminUserId,
          publishVersion: { increment: 1 },
          version: { increment: 1 },
        },
      });

      await prisma.dishMedia.updateMany({
        where: { dishId: d.id },
        data: { moderationStatus: 'APPROVED' },
      });
      console.log(`✅ Đã xuất bản món: ${d.name}`);
    }
  }

  const allDishes = await prisma.dish.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, status: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\nTổng cộng hiện tại có ${allDishes.length} món trong hệ thống:`);
  console.log(`- PUBLISHED: ${allDishes.filter(d => d.status === 'PUBLISHED').length}`);
  console.log(`- DRAFT: ${allDishes.filter(d => d.status === 'DRAFT').length}`);

  await prisma.$disconnect();
}

main().catch(console.error);
