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
  console.log('================================================================');
  console.log('    KIỂM TRA CHUYÊN SÂU TOÀN BỘ DỮ LIỆU MÓN ĂN & HÌNH ẢNH MOGU  ');
  console.log('================================================================\n');

  // 1. All dishes regardless of status or deletedAt
  const allDishes = await prisma.dish.findMany({
    include: {
      media: true,
      province: true,
      region: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`[1] TỔNG QUAN BẢNG DISHES:`);
  console.log(`- Tổng số bản ghi món ăn trong DB: ${allDishes.length}`);

  const activeDishes = allDishes.filter(d => d.deletedAt === null);
  const deletedDishes = allDishes.filter(d => d.deletedAt !== null);
  console.log(`  + Đang hoạt động (deletedAt is null): ${activeDishes.length}`);
  console.log(`  + Đã xoá mềm (deletedAt is NOT null): ${deletedDishes.length}`);

  // Breakdown by status for active dishes
  const statusCount: Record<string, number> = {};
  for (const d of activeDishes) {
    statusCount[d.status] = (statusCount[d.status] || 0) + 1;
  }
  console.log(`- Phân bố theo trạng thái (Active):`, statusCount);

  // 2. Inspect media for all active dishes
  console.log(`\n[2] PHÂN TÍCH HÌNH ẢNH CỦA ${activeDishes.length} MÓN HOẠT ĐỘNG:`);
  const dishesNoMedia: typeof activeDishes = [];
  const dishesNoPrimary: typeof activeDishes = [];
  const dishesWithPlaceholder: { dish: typeof activeDishes[0]; reason: string }[] = [];
  const dishesGoodMedia: typeof activeDishes = [];

  for (const d of activeDishes) {
    if (d.media.length === 0) {
      dishesNoMedia.push(d);
      continue;
    }

    const primary = d.media.find(m => m.isPrimary);
    if (!primary) {
      dishesNoPrimary.push(d);
      continue;
    }

    // Check if image is placeholder or suspicious
    const key = primary.storageKey || '';
    const src = primary.sourceUrl || '';
    const isPlaceholder =
      key.includes('placeholder') ||
      key.includes('default') ||
      src.includes('placeholder') ||
      src.includes('default') ||
      src.includes('unsplash') ||
      key.trim() === '' ||
      src.trim() === '';

    if (isPlaceholder) {
      dishesWithPlaceholder.push({ dish: d, reason: `Suspicious key/src: key="${key}", src="${src}"` });
    } else {
      dishesGoodMedia.push(d);
    }
  }

  console.log(`- Món hoàn toàn KHÔNG CÓ media: ${dishesNoMedia.length}`);
  if (dishesNoMedia.length > 0) {
    dishesNoMedia.forEach((d, i) => console.log(`  ${i + 1}. [${d.id}] "${d.name}" (${d.status})`));
  }

  console.log(`- Món CÓ media nhưng KHÔNG CÓ primary: ${dishesNoPrimary.length}`);
  if (dishesNoPrimary.length > 0) {
    dishesNoPrimary.forEach((d, i) => console.log(`  ${i + 1}. [${d.id}] "${d.name}" (${d.status})`));
  }

  console.log(`- Món có media nghi vấn / placeholder: ${dishesWithPlaceholder.length}`);
  if (dishesWithPlaceholder.length > 0) {
    dishesWithPlaceholder.forEach((item, i) => console.log(`  ${i + 1}. [${item.dish.id}] "${item.dish.name}": ${item.reason}`));
  }

  console.log(`- Món có ảnh hợp lệ: ${dishesGoodMedia.length}`);

  // 3. Inspect AI generated vs non-AI images
  const aiGeneratedDishes = dishesGoodMedia.filter(d => {
    const p = d.media.find(m => m.isPrimary)!;
    return p.credit?.includes('AI') || p.storageKey?.includes('ai-') || p.altText?.includes('AI');
  });
  console.log(`- Món có ảnh được tạo bởi AI: ${aiGeneratedDishes.length}`);
  console.log(`- Món có ảnh KHÔNG ghi nhận AI: ${dishesGoodMedia.length - aiGeneratedDishes.length}`);

  // 4. Check all distinct storageKey patterns
  console.log('\n[3] MẪU STORAGE KEYS:');
  const sampleKeys = dishesGoodMedia.slice(0, 10).map(d => {
    const p = d.media.find(m => m.isPrimary)!;
    return `${d.name}: ${p.storageKey} (${p.bucket})`;
  });
  sampleKeys.forEach(k => console.log('• ' + k));

  // 5. Check if there are other dishes in dish_file_imports or ai_import_jobs
  const importJobs = await prisma.aiImportJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log(`\n[4] AI IMPORT JOBS GẦN ĐÂY: ${importJobs.length}`);
  importJobs.forEach(j => console.log(`• [${j.id}] status=${j.status}, totalDishes=${j.totalDishes}, completed=${j.completedDishes}, error=${j.errorMessage}`));
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});
