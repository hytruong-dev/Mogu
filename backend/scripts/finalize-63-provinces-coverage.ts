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
  console.log(`=== ĐỒNG BỘ VÀ HOÀN TẤT ĐỘ PHỦ 63 TỈNH THÀNH VIỆT NAM ===\n`);

  // 1. Sửa mapping cho 4 tỉnh bị lệch
  const corrections = [
    { dishName: 'Bún thang lươn Hưng Yên', targetProvinceCode: 'hungyen' },
    { dishName: 'Vịt quay lá móc mật Lạng Sơn', targetProvinceCode: 'langson' },
    { dishName: 'Chả cá thác lác Hậu Giang', targetProvinceCode: 'haugiang' },
    { dishName: 'Bánh tráng phơi sương cuốn thịt luộc Trảng Bàng', targetProvinceCode: 'tayninh' },
  ];

  for (const c of corrections) {
    const province = await prisma.province.findFirst({
      where: { code: c.targetProvinceCode },
      include: { region: true },
    });
    if (!province) {
      console.log(`❌ Không tìm thấy tỉnh: ${c.targetProvinceCode}`);
      continue;
    }

    const res = await prisma.dish.updateMany({
      where: {
        name: { equals: c.dishName, mode: 'insensitive' },
        deletedAt: null,
      },
      data: {
        provinceId: province.id,
        regionId: province.regionId,
        originText: province.name,
        status: 'PUBLISHED',
      },
    });

    console.log(`✅ Đã điều chỉnh "${c.dishName}" về đúng tỉnh ${province.name} (${province.region.name}) - [${res.count} món cập nhật]`);
  }

  // 2. Xử lý trùng lặp các món bị nhập lại (nếu có 2 bản sao cùng tên)
  const duplicates = [
    'Bánh mướt ram giò Hà Tĩnh',
    'Gà đồi Yên Thế hấp lá chanh',
    'Tôm chua Ba Bể cuốn thịt luộc',
    'Thịt lợn mán nướng Bản Mường',
    'Cơm cháy sốt thịt dê Ninh Bình',
    'Canh cá Quỳnh Côi',
    'Gỏi măng cụt gà xé Bình Dương',
    'Chả cá thác lác Hậu Giang',
  ];

  console.log(`\n🧹 Đang kiểm tra và loại bỏ món trùng lặp (giữ lại bản ghi đầy đủ nhất)...`);
  for (const name of duplicates) {
    const dishes = await prisma.dish.findMany({
      where: { name: { equals: name, mode: 'insensitive' }, deletedAt: null },
      include: {
        media: true,
        dishIngredients: true,
        recipeSteps: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (dishes.length > 1) {
      // Giữ lại bản ghi có media hoặc nhiều nguyên liệu nhất, hoặc bản ghi đầu tiên
      dishes.sort((a, b) => {
        const scoreA = (a.media.length * 10) + a.dishIngredients.length + a.recipeSteps.length;
        const scoreB = (b.media.length * 10) + b.dishIngredients.length + b.recipeSteps.length;
        return scoreB - scoreA;
      });

      const keep = dishes[0];
      const toRemove = dishes.slice(1);

      console.log(`- Món "${name}": Tìm thấy ${dishes.length} bản ghi -> Giữ ID ${keep.id}`);
      for (const d of toRemove) {
        await prisma.dish.update({
          where: { id: d.id },
          data: { deletedAt: new Date() },
        });
        console.log(`  🗑️ Đã xóa mềm bản ghi trùng ID ${d.id}`);
      }
    }
  }

  // 3. Đối soát lại 100% các tỉnh thành
  const provinces = await prisma.province.findMany({
    include: {
      region: true,
      dishes: {
        where: { deletedAt: null, status: 'PUBLISHED' },
        select: { id: true, name: true, nutrition: { select: { calories: true } } },
      },
    },
    orderBy: [
      { region: { code: 'asc' } },
      { name: 'asc' },
    ],
  });

  console.log(`\n================ BẢNG TỔNG KẾT 63 TỈNH THÀNH VIỆT NAM ================\n`);
  let coveredProvinces = 0;
  const missingProvinces: string[] = [];

  provinces.forEach((p, idx) => {
    if (p.dishes.length > 0) {
      coveredProvinces++;
      const dishNames = p.dishes.map((d) => d.name).join(', ');
      console.log(`${idx + 1}. [${p.code}] ${p.name.padEnd(20, ' ')} (${p.region.name.padEnd(12, ' ')}) -> ${dishNames}`);
    } else {
      missingProvinces.push(`${p.name} [${p.code}]`);
    }
  });

  const totalPublishedDishes = await prisma.dish.count({
    where: { deletedAt: null, status: 'PUBLISHED' },
  });

  console.log(`\n======================================================================`);
  console.log(`🎉 TỔNG KẾT ĐỘ PHỦ ĐẶC SẢN TOÀN QUỐC:`);
  console.log(`• Tổng số tỉnh thành có món: ${coveredProvinces} / ${provinces.length}`);
  console.log(`• Tỉnh còn thiếu: ${missingProvinces.length === 0 ? 'KHÔNG CÒN TỈNH NÀO THIẾU (100% ĐỘ PHỦ)' : missingProvinces.join(', ')}`);
  console.log(`• Tổng số món ĐÃ XUẤT BẢN trong hệ thống: ${totalPublishedDishes}`);
  console.log(`======================================================================\n`);
}

main().finally(() => prisma.$disconnect());
