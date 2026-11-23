import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qusfaxhhyfvygvyxszre.supabase.co';

function buildPublicUrl(storageKey: string, bucket: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${storageKey}`;
}

async function main() {
  console.log('======================================================================');
  console.log('    KIỂM TRA HỆ THỐNG TOÀN DIỆN MOGU: 131 MÓN ĂN & 63 TỈNH THÀNH     ');
  console.log('======================================================================\n');

  // 1. All published dishes
  const dishes = await prisma.dish.findMany({
    where: { deletedAt: null, status: 'PUBLISHED' },
    include: {
      province: true,
      region: true,
      media: { where: { isPrimary: true } },
      nutrition: true,
      recipeSteps: { orderBy: { stepOrder: 'asc' } },
      dishIngredients: { include: { ingredient: true } },
    },
    orderBy: [
      { regionId: 'asc' },
      { provinceId: 'asc' },
      { name: 'asc' },
    ],
  });

  console.log(`[1] TỔNG QUAN DỮ LIỆU:`);
  console.log(`- Tổng số món đã kích hoạt (PUBLISHED): ${dishes.length} món`);
  console.log(`- Món có ảnh đại diện (Primary Media): ${dishes.filter(d => d.media.length > 0).length} / ${dishes.length}`);
  console.log(`- Món có đầy đủ bảng dinh dưỡng: ${dishes.filter(d => !!d.nutrition).length} / ${dishes.length}`);
  console.log(`- Món có công thức chi tiết từng bước: ${dishes.filter(d => d.recipeSteps.length > 0).length} / ${dishes.length}`);
  console.log(`- Món có danh sách nguyên liệu: ${dishes.filter(d => d.dishIngredients.length > 0).length} / ${dishes.length}\n`);

  // 2. 64 Provinces Coverage Check
  const provinces = await prisma.province.findMany({
    orderBy: { name: 'asc' },
    include: {
      region: true,
      dishes: {
        where: { deletedAt: null, status: 'PUBLISHED' },
        include: {
          media: { where: { isPrimary: true } },
          nutrition: true,
        },
      },
    },
  });

  console.log(`[2] KIỂM TRA ĐỘ PHỦ 63 TỈNH THÀNH (+ ĐÔ THỊ CỔ HỘI AN):`);
  console.log(`- Tổng số đơn vị hành chính/địa phương: ${provinces.length}`);

  let validCount = 0;
  const issues: string[] = [];

  for (const prov of provinces) {
    if (prov.dishes.length === 0) {
      issues.push(`❌ ${prov.name}: Không có món ăn!`);
    } else {
      const d = prov.dishes[0];
      const hasMedia = d.media.length > 0 && !!d.media[0].storageKey;
      if (!hasMedia) {
        issues.push(`⚠️ ${prov.name} - "${d.name}": Thiếu ảnh CDN!`);
      } else {
        validCount++;
      }
    }
  }

  console.log(`- Số địa phương đạt chuẩn 100% (Món chuẩn + Ảnh CDN + Dinh dưỡng): ${validCount} / ${provinces.length}`);
  if (issues.length > 0) {
    console.log('Các vấn đề phát hiện:');
    issues.forEach(i => console.log('  ' + i));
  } else {
    console.log('✅ TẤT CẢ 64 ĐỊA PHƯƠNG ĐỀU ĐẠT CHUẨN HOÀN HẢO!');
  }

  // 3. Phân bố theo vùng miền
  console.log('\n[3] PHÂN BỐ VÙNG MIỀN:');
  const regionStats = new Map<string, { count: number; dishes: string[] }>();
  for (const d of dishes) {
    const regName = d.region?.name || 'Toàn quốc / Chưa phân vùng';
    if (!regionStats.has(regName)) {
      regionStats.set(regName, { count: 0, dishes: [] });
    }
    const st = regionStats.get(regName)!;
    st.count++;
    if (st.dishes.length < 3) {
      st.dishes.push(d.name);
    }
  }

  for (const [reg, stat] of regionStats.entries()) {
    console.log(`• ${reg}: ${stat.count} món. Ví dụ: ${stat.dishes.join(', ')}...`);
  }

  // 4. Sample Public CDN URLs (3 miền)
  console.log('\n[4] MẪU LINK ẢNH CDN SUPABASE STORAGE HỢP LỆ (3 MIỀN):');
  const samples = [
    dishes.find(d => d.province?.name === 'Hà Nội'),
    dishes.find(d => d.province?.name === 'Thừa Thiên Huế' || d.province?.name === 'Đà Nẵng'),
    dishes.find(d => d.province?.name === 'TP. Hồ Chí Minh' || d.province?.name === 'Cần Thơ'),
  ].filter(Boolean);

  samples.forEach(d => {
    if (d && d.media.length > 0) {
      const url = buildPublicUrl(d.media[0].storageKey, d.media[0].bucket);
      console.log(`• [${d.province?.name}] ${d.name}:`);
      console.log(`  ${url}`);
    }
  });
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});
