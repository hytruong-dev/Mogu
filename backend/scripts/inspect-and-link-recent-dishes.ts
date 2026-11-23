import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { VIETNAM_63_SPECIALTIES } from './plan-63-provinces';

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== KIỂM TRA TOÀN BỘ CÁC MÓN VỪA ĐƯỢC TẠO HOẶC CÓ TRONG HỆ THỐNG ===\n');

  // Lấy toàn bộ món (cả DRAFT và PUBLISHED, phục hồi nếu bị soft-delete nhầm)
  const allDishes = await prisma.dish.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      provinceId: true,
      regionId: true,
      originText: true,
      deletedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Tổng số món tìm thấy trong DB: ${allDishes.length}`);

  const provinces = await prisma.province.findMany({
    include: { region: true },
  });
  const provinceByCode = new Map(provinces.map((p) => [p.code, p]));

  // Duyệt qua 63 món trong bảng quy hoạch chuẩn
  let linkedCount = 0;
  let restoredCount = 0;
  let publishedCount = 0;

  for (const s of VIETNAM_63_SPECIALTIES) {
    const province = provinceByCode.get(s.provinceCode);
    if (!province) {
      console.log(`⚠️ Không tìm thấy tỉnh: ${s.provinceCode}`);
      continue;
    }

    // Tìm món khớp tên (hoặc tương tự)
    const matchedDishes = allDishes.filter((d) => {
      const dName = d.name.toLowerCase().trim();
      const sName = s.dishName.toLowerCase().trim();
      return (
        dName === sName ||
        dName.includes(sName) ||
        sName.includes(dName)
      );
    });

    if (matchedDishes.length === 0) {
      console.log(`❌ CHƯA CÓ TRONG DB: [${s.provinceCode}] ${province.name} -> "${s.dishName}"`);
      continue;
    }

    // Chọn bản ghi tốt nhất (ưu tiên chưa bị xóa, hoặc mới nhất)
    matchedDishes.sort((a, b) => {
      if (!a.deletedAt && b.deletedAt) return -1;
      if (a.deletedAt && !b.deletedAt) return 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    const bestDish = matchedDishes[0];

    // Cập nhật trạng thái PUBLISHED, phục hồi nếu deletedAt, và gán đúng provinceId
    const updateData: any = {
      status: 'PUBLISHED',
      provinceId: province.id,
      regionId: province.regionId,
      originText: province.name,
      deletedAt: null, // Phục hồi nếu bị xóa nhầm
    };

    await prisma.dish.update({
      where: { id: bestDish.id },
      data: updateData,
    });

    // Nếu có các bản sao khác của món này, đánh dấu deletedAt để không bị duplicate
    for (let i = 1; i < matchedDishes.length; i++) {
      await prisma.dish.update({
        where: { id: matchedDishes[i].id },
        data: { deletedAt: new Date() },
      });
    }

    console.log(`✅ [${s.provinceCode}] ${province.name.padEnd(20)} -> "${bestDish.name}" (ID: ${bestDish.id}, status: PUBLISHED, province: ${province.name})`);
    linkedCount++;
  }

  // Đối soát lại
  const finalProvinces = await prisma.province.findMany({
    include: {
      region: true,
      dishes: {
        where: { deletedAt: null, status: 'PUBLISHED' },
        select: { id: true, name: true },
      },
    },
    orderBy: [{ region: { code: 'asc' } }, { name: 'asc' }],
  });

  const covered = finalProvinces.filter((p) => p.dishes.length > 0);
  const missing = finalProvinces.filter((p) => p.dishes.length === 0);

  console.log(`\n================ KẾT QUẢ ĐỐI SOÁT ================`);
  console.log(`• Tỉnh có món: ${covered.length} / ${finalProvinces.length}`);
  console.log(`• Tỉnh thiếu: ${missing.length}`);
  if (missing.length > 0) {
    missing.forEach((m) => console.log(`  - [${m.code}] ${m.name} (${m.region.name})`));
  }
}

main().finally(() => prisma.$disconnect());
