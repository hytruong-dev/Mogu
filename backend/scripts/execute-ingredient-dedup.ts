import 'dotenv/config';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { COMPLETE_MERGE_MAP } from './verify-complete-merge-map';

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`=== BẮT ĐẦU CHUẨN HÓA VÀ HỢP NHẤT NGUYÊN LIỆU TRÙNG LẶP ===`);
  console.log(`Chế độ: ${isDryRun ? 'DRY-RUN (Chỉ kiểm tra, không ghi DB)' : 'THỰC THI THỰC TẾ (Commit vào DB)'}`);

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const active = await prisma.ingredient.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true }
  });

  const pending = await prisma.ingredient.findMany({
    where: { status: 'PENDING_REVIEW' },
    include: {
      dishIngredients: {
        include: { dish: { select: { id: true, name: true } } }
      }
    }
  });

  console.log(`Tổng số nguyên liệu Active: ${active.length}`);
  console.log(`Tổng số nguyên liệu Pending: ${pending.length}\n`);

  let mergedCount = 0;
  let dishesUpdatedCount = 0;
  let deletedPendingCount = 0;

  for (const p of pending) {
    const mapping = COMPLETE_MERGE_MAP[p.name];
    if (!mapping) {
      // Giữ lại nguyên liệu đặc thù
      continue;
    }

    const targetActive = active.find(
      (a) => a.name.toLowerCase().trim() === mapping.targetName.toLowerCase().trim()
    );

    if (!targetActive) {
      console.warn(`⚠️ Không tìm thấy target active "${mapping.targetName}" cho pending "${p.name}"`);
      continue;
    }

    console.log(`\n🔄 [${mergedCount + 1}] Xử lý: "${p.name}" (${p.code})`);
    console.log(`   👉 Chuyển sang Active: "${targetActive.name}" (${targetActive.code})`);
    console.log(`   📝 Lý do: ${mapping.reason}`);
    console.log(`   🍽️ Các món bị ảnh hưởng (${p.dishIngredients.length}): ${p.dishIngredients.map(di => di.dish.name).join(', ')}`);

    if (!isDryRun) {
      // 1. Cập nhật tất cả DishIngredient trỏ sang targetActive
      for (const di of p.dishIngredients) {
        await prisma.dishIngredient.update({
          where: { id: di.id },
          data: {
            ingredientId: targetActive.id,
            parsedName: targetActive.name,
            needsReview: false,
            resolutionConfidence: 100,
          }
        });
        dishesUpdatedCount++;
      }

      // 2. Dọn dẹp các quan hệ phụ thuộc của pending ingredient
      await prisma.ingredientImageCandidate.deleteMany({
        where: { ingredientId: p.id }
      });

      await prisma.userAvoidedIngredient.deleteMany({
        where: { ingredientId: p.id }
      });

      // 3. Xóa hoàn toàn bản ghi pending bị trùng khỏi database
      await prisma.ingredient.delete({
        where: { id: p.id }
      });
      deletedPendingCount++;
    }

    mergedCount++;
  }

  // Xử lý riêng trường hợp công cụ / dụng cụ "Khuôn chén sành làm bánh bèo"
  const toolItem = pending.find(p => p.name.includes('Khuôn chén sành làm bánh bèo'));
  if (toolItem) {
    console.log(`\n🗑️ Xóa công cụ/dụng cụ không phải nguyên liệu thực phẩm: "${toolItem.name}"`);
    if (!isDryRun) {
      await prisma.dishIngredient.deleteMany({
        where: { ingredientId: toolItem.id }
      });
      await prisma.ingredientImageCandidate.deleteMany({
        where: { ingredientId: toolItem.id }
      });
      await prisma.ingredient.delete({
        where: { id: toolItem.id }
      });
      deletedPendingCount++;
    }
  }

  console.log(`\n======================================================`);
  console.log(`TỔNG KẾT CHUẨN HÓA NGUYÊN LIỆU:`);
  console.log(`- Đã hợp nhất vào Active: ${mergedCount} nguyên liệu`);
  console.log(`- Số lượt DishIngredient được cập nhật sang ID chuẩn: ${dishesUpdatedCount}`);
  console.log(`- Đã xóa khỏi hàng đợi "Cần duyệt": ${deletedPendingCount} mục`);
  
  if (!isDryRun) {
    const remainingPending = await prisma.ingredient.count({
      where: { status: 'PENDING_REVIEW' }
    });
    console.log(`- Số nguyên liệu đặc thù CẦN DUYỆT còn lại: ${remainingPending} mục (đã sẵn sàng để Admin duyệt tay)`);
  }
  console.log(`======================================================\n`);
}

main().catch(console.error);
