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
    where: {
      name: { in: NEW_30 },
      deletedAt: null,
    },
    include: {
      media: {
        where: { isPrimary: true }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`=== KIỂM TRA ẢNH ĐẠI DIỆN 30 MÓN ĂN MỚI ===\n`);
  const missing: any[] = [];
  const existing: any[] = [];

  dishes.forEach((d, idx) => {
    const primary = d.media[0];
    if (primary && primary.storageKey) {
      existing.push({ idx: idx + 1, name: d.name, key: primary.storageKey });
    } else {
      missing.push({ idx: idx + 1, id: d.id, name: d.name });
    }
  });

  console.log(`✅ Đã có ảnh đại diện (${existing.length} món):`);
  existing.forEach(e => console.log(`   ${e.idx}. ${e.name} (${e.key})`));

  console.log(`\n❌ Chưa có ảnh đại diện AI (${missing.length} món):`);
  missing.forEach(m => console.log(`   ${m.idx}. [ID: ${m.id}] ${m.name}`));
}

main().finally(() => prisma.$disconnect());
