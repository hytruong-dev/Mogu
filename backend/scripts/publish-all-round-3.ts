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
  const profile = await prisma.profile.findFirst();

  const res = await prisma.dish.updateMany({
    where: {
      name: { in: NEW_30 },
      deletedAt: null,
    },
    data: {
      status: 'PUBLISHED',
      publishedAt: new Date(),
      reviewedAt: new Date(),
      reviewedBy: profile?.userId,
    }
  });

  await prisma.dishMedia.updateMany({
    where: {
      dish: { name: { in: NEW_30 } }
    },
    data: {
      moderationStatus: 'APPROVED'
    }
  });

  console.log(`✅ Đã cập nhật trạng thái PUBLISHED cho ${res.count} món ăn!`);

  const publishedCount = await prisma.dish.count({
    where: { status: 'PUBLISHED', deletedAt: null }
  });
  console.log(`Tổng số món ĐÃ XUẤT BẢN trong hệ thống: ${publishedCount} / 93 món`);
}

main().finally(() => prisma.$disconnect());
