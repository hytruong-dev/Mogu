import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const dishes = await prisma.dish.findMany({
    where: { deletedAt: null },
    include: {
      media: {
        where: { isPrimary: true }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  const supabaseUrl = process.env.SUPABASE_URL || 'https://lkqvyvllmrbxgaoqrkhd.supabase.co';
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'dish-images';

  console.log('========================================================================');
  console.log(`BÁO CÁO TOÀN DIỆN 60 MÓN ĂN - ẢNH AI CHỤP CHÂN THỰC 4K TRÊN SUPABASE`);
  console.log('========================================================================');
  console.log(`Tổng số món ăn trong Database: ${dishes.length}`);
  const completed = dishes.filter(d => d.media.length > 0 && d.media[0].storageKey);
  console.log(`Món ăn đã có ảnh đại diện AI chính thức trên Supabase: ${completed.length} / ${dishes.length}`);
  console.log('------------------------------------------------------------------------');

  dishes.forEach((d, idx) => {
    const primaryMedia = d.media[0];
    const status = primaryMedia ? '✅' : '❌';
    const publicUrl = primaryMedia
      ? `${supabaseUrl}/storage/v1/object/public/${primaryMedia.bucket || bucketName}/${primaryMedia.storageKey}`
      : 'CHƯA CÓ ẢNH';
    console.log(`${idx + 1}. ${status} [${d.name}]`);
    console.log(`   🔗 ${publicUrl}`);
  });

  console.log('========================================================================');
}

main().catch(console.error);
