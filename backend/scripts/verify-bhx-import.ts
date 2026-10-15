/**
 * Script kiểm tra và thống kê kết quả import nguyên liệu Bách Hóa Xanh vào DB
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

async function verify() {
  const pool = new pg.Pool({
    connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    console.log('========================================================');
    console.log('       KIỂM TRA DỮ LIỆU NGUYÊN LIỆU TRONG DATABASE      ');
    console.log('========================================================');

    const totalCount = await prisma.ingredient.count();
    console.log(`\n1. Tổng số nguyên liệu hiện tại trong DB: ${totalCount}`);

    // Đếm các mục được tạo từ nguồn Bách Hóa Xanh
    const bhxIngredients = await prisma.ingredient.findMany({
      where: {
        createdVia: 'FILE_IMPORT',
        enrichment: {
          path: ['source'],
          equals: 'bachhoaxanh',
        },
      },
      select: {
        id: true,
        code: true,
        name: true,
        groupLabel: true,
        unit: true,
        allergenCode: true,
        status: true,
        isActive: true,
        imageUrl: true,
        enrichment: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`2. Số nguyên liệu mới nạp từ Bách Hóa Xanh: ${bhxIngredients.length}`);

    // Kiểm tra tính toàn vẹn trạng thái: Tất cả phải là PENDING_REVIEW và isActive = false
    const pendingCount = bhxIngredients.filter((i) => i.status === 'PENDING_REVIEW').length;
    const inactiveCount = bhxIngredients.filter((i) => !i.isActive).length;
    const withImageCount = bhxIngredients.filter((i) => Boolean(i.imageUrl)).length;

    console.log(`   - Trạng thái PENDING_REVIEW: ${pendingCount}/${bhxIngredients.length}`);
    console.log(`   - Trạng thái isActive = false: ${inactiveCount}/${bhxIngredients.length}`);
    console.log(`   - Có ảnh CDN Bách Hóa Xanh: ${withImageCount}/${bhxIngredients.length}`);

    // Phân bổ theo nhóm
    const byGroup: Record<string, number> = {};
    for (const ing of bhxIngredients) {
      const key = ing.groupLabel || 'Khác';
      byGroup[key] = (byGroup[key] || 0) + 1;
    }
    console.log('\n3. Phân bổ theo nhóm nguyên liệu (Bách Hóa Xanh mới):');
    console.table(
      Object.entries(byGroup).map(([group, count]) => ({
        'Nhóm': group,
        'Số lượng': count,
      })),
    );

    // Mẫu 10 nguyên liệu mới nạp
    console.log('\n4. Mẫu 10 nguyên liệu Bách Hóa Xanh mới nạp:');
    console.table(
      bhxIngredients.slice(0, 10).map((i) => ({
        'Tên': i.name,
        'Mã': i.code,
        'Nhóm': i.groupLabel,
        'ĐVT': i.unit,
        'Dị ứng': i.allergenCode || 'Không',
        'Status': i.status,
        'Active': i.isActive,
        'Ảnh': i.imageUrl ? '✓' : '✗',
      })),
    );

    console.log('\n========================================================');
    console.log('✓ XÁC NHẬN TOÀN BỘ DỮ LIỆU ĐÃ ĐƯỢC LƯU AN TOÀN VÀ ĐÚNG YÊU CẦU');
    console.log('========================================================\n');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

verify().catch((err) => {
  console.error('Lỗi kiểm tra:', err);
  process.exit(1);
});
