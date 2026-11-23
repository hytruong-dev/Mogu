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
      dishIngredients: true,
      nutrition: true,
      recipeSteps: true,
      media: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`=== CHI TIẾT 30 MÓN ĂN MỚI ĐÃ NHẬP (${dishes.length} món) ===\n`);
  dishes.forEach((d, idx) => {
    const hasMedia = d.media.length > 0 ? `✅ ${d.media.length} ảnh` : '⚠️ Chưa có ảnh';
    const cal = d.nutrition ? `${d.nutrition.calories} kcal` : 'N/A';
    console.log(`${idx + 1}. [${d.status}] ${d.name}`);
    console.log(`   - Nguyên liệu: ${d.dishIngredients.length} mục | Các bước: ${d.recipeSteps.length} bước | Calo: ${cal}`);
    console.log(`   - Media: ${hasMedia}`);
  });

  const totalAllDishes = await prisma.dish.count({ where: { deletedAt: null } });
  console.log(`\nTổng số món ăn hiện có trong toàn bộ cơ sở dữ liệu: ${totalAllDishes}`);
}

main().finally(() => prisma.$disconnect());
