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
    where: { deletedAt: null },
    select: { id: true, name: true, status: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Tổng số món ăn trong DB: ${dishes.length}`);
  const existingNames = new Set(dishes.map(d => d.name.toLowerCase().trim()));

  const imported: string[] = [];
  const pendingToImport: string[] = [];

  for (const name of NEW_30) {
    if (existingNames.has(name.toLowerCase().trim())) {
      imported.push(name);
    } else {
      pendingToImport.push(name);
    }
  }

  console.log(`\n✅ Đã nhập thành công từ đợt 3: ${imported.length} / 30 món:`);
  imported.forEach((m, idx) => console.log(`   ${idx + 1}. ${m}`));

  console.log(`\n⏳ Còn lại cần nhập tiếp: ${pendingToImport.length} / 30 món:`);
  pendingToImport.forEach((m, idx) => console.log(`   ${idx + 1}. ${m}`));
}

main().finally(() => prisma.$disconnect());
