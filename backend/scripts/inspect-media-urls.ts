import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const NEW_30 = [
  'Miến lươn Hà Nội',
  'Cơm rang dưa bò',
  'Chả rươi Tứ Kỳ',
  'Vịt om sấu',
  'Canh cua mồng tơi cà pháo',
  'Bánh đúc nóng Hà Nội',
  'Thịt đông dưa chua',
  'Cá kho làng Vũ Đại',
  'Bún cá rô đồng',
  'Phở cuốn Hà Nội',
  'Gỏi cá mai Nha Trang',
  'Hến xào xúc bánh tráng',
  'Bánh tráng cuốn thịt heo Đà Nẵng',
  'Bánh ướt thịt nướng Huế',
  'Lẩu cá bớp măng chua',
  'Bánh canh hẹ Phú Yên',
  'Cơm lam gà nướng Tây Nguyên',
  'Bánh hỏi cháo lòng Bình Định',
  'Bánh đập mắm nêm Quảng Nam',
  'Cơm gà Tam Kỳ',
  'Cá lóc nướng trui miền Tây',
  'Hủ tiếu Sa Đéc',
  'Lẩu cua đồng miền Tây',
  'Bánh cóng Sóc Trăng',
  'Bún kèn Kiên Giang',
  'Bánh tằm bì nước cốt dừa',
  'Bún thịt nướng chả giò Sài Gòn',
  'Bánh xèo củ hũ dừa Bến Tre',
  'Lẩu vịt nấu chao Cần Thơ',
  'Cá kho tộ miền Tây',
];

async function main() {
  const dishes = await prisma.dish.findMany({
    where: { name: { in: NEW_30 }, deletedAt: null },
    include: { media: true },
    orderBy: { createdAt: 'asc' },
  });

  const supabaseUrl = process.env.SUPABASE_URL || 'https://lkqvyvllmrbxgaoqrkhd.supabase.co';

  console.log(`=== MEDIA CỦA 30 MÓN ĂN MỚI ===\n`);
  dishes.forEach((d, idx) => {
    console.log(`${idx + 1}. [${d.name}] (ID: ${d.id})`);
    if (d.media.length === 0) {
      console.log(`   ❌ KHÔNG CÓ MEDIA NÀO`);
    } else {
      d.media.forEach(m => {
        const url = `${supabaseUrl}/storage/v1/object/public/${m.bucket}/${m.storageKey}`;
        console.log(`   📸 [isPrimary: ${m.isPrimary}, status: ${m.moderationStatus}] ${url}`);
      });
    }
  });
}

main().finally(() => prisma.$disconnect());
