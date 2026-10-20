import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const TARGET_30_NAMES = [
  'Phở bò',
  'Bún chả Hà Nội',
  'Bún đậu mắm tôm',
  'Bún riêu cua đồng',
  'Chả cá Lã Vọng',
  'Bún ốc Hà Nội',
  'Bò sốt vang bánh mì',
  'Xôi xéo Hà Nội',
  'Bún mọc sườn chua',
  'Lẩu riêu cua bắp bò',
  'Bún bò Huế',
  'Mì Quảng tôm thịt',
  'Cơm gà Hội An',
  'Cao lầu Hội An',
  'Bún chả cá Nha Trang',
  'Bánh bột lọc Huế',
  'Bánh bèo chén',
  'Nem lụi nướng',
  'Bánh căn xíu mại',
  'Bún sứa Quy Nhơn',
  'Cơm tấm sườn bì chả',
  'Bánh mì thịt nướng',
  'Hủ tiếu Nam Vang',
  'Gỏi cuốn tôm thịt',
  'Bò kho bánh mì',
  'Cơm gà xối mỡ',
  'Cơm bò lúc lắc',
  'Hủ tiếu Mỹ Tho',
  'Bánh canh ghẹ',
  'Bánh xèo miền Tây',
];

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  console.log(`Kiểm tra trạng thái media của 30 món ăn...`);

  const dishes = await prisma.dish.findMany({
    where: {
      name: { in: TARGET_30_NAMES },
      deletedAt: null,
    },
    include: {
      media: {
        where: { isPrimary: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Tìm thấy ${dishes.length} món trong DB.\n`);

  for (let i = 0; i < TARGET_30_NAMES.length; i++) {
    const name = TARGET_30_NAMES[i];
    const dish = dishes.find((d) => d.name.toLowerCase().trim() === name.toLowerCase().trim());
    if (!dish) {
      console.log(`[${i + 1}/30] ❌ KHÔNG TÌM THẤY MÓN: ${name}`);
      continue;
    }

    const primaryMedia = dish.media[0];
    if (!primaryMedia) {
      console.log(`[${i + 1}/30] ⚠️ ${dish.name}: Chưa có primary media`);
    } else {
      const isSupabase = primaryMedia.sourceUrl?.includes('supabase.co');
      const isAi = primaryMedia.sourceUrl?.includes('ai-photo') || primaryMedia.credit?.includes('AI');
      const typeTag = isAi ? '[🎨 AI Generated]' : isSupabase ? '[☁️ Supabase]' : '[🌐 External]';
      console.log(`[${i + 1}/30] ${typeTag} ${dish.name}:`);
      console.log(`     URL: ${primaryMedia.sourceUrl}`);
      console.log(`     Status: ${primaryMedia.moderationStatus}, isPrimary: ${primaryMedia.isPrimary}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
