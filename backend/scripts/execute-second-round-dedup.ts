import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SECOND_ROUND_MAP = [
  {
    pendingCode: 'dau-phu-ran-vang-h6kub',
    pendingName: 'Đậu phụ rán vàng',
    targetActiveCode: 'tau-chien-3wkkc',
    targetActiveName: 'Tàu chiên',
    reason: 'Đã có "Tàu chiên" (Đậu hũ chiên / Đậu phụ rán vàng) trong DB'
  },
  {
    pendingCode: 'bot-gia-vi-bo-kho-iayya',
    pendingName: 'Bột gia vị bò kho',
    targetActiveCode: 'xot-bo-kho-bfkln',
    targetActiveName: 'Xốt bò kho',
    reason: 'Đã có "Xốt bò kho" (Gia vị bò kho hoàn chỉnh) trong DB'
  },
  {
    pendingCode: 'ruou-vang-do-nau-an-5yg6f',
    pendingName: 'Rượu vang đỏ nấu ăn',
    targetActiveCode: 'ruou-nau-an-rtbo9',
    targetActiveName: 'Rượu nấu ăn',
    reason: 'Đã có "Rượu nấu ăn" trong DB'
  },
  {
    pendingCode: 'mi-trung-tuoi-soi-tron-2ji9y',
    pendingName: 'Mì trứng tươi sợi tròn',
    targetActiveCode: 'mi-soi-gno75',
    targetActiveName: 'Mì sợi',
    reason: 'Đã có "Mì sợi" trong DB (hình ảnh Mì trứng Safoco cao cấp)'
  },
  {
    pendingCode: 'sot-tuong-den-cay-gb19u',
    pendingName: 'Sốt tương đen cay',
    targetActiveCode: 'xi-dau-nuoc-tuong-den-n5jv8',
    targetActiveName: 'Xì dầu (Nước tương đen)',
    reason: 'Đã có "Xì dầu (Nước tương đen)" trong DB'
  },
  {
    pendingCode: 'du-du-chua-ngam-gion-k9s9r',
    pendingName: 'Đu đủ chua ngâm giòn',
    targetActiveCode: 'du-du-xanh-qk3ut',
    targetActiveName: 'Đu đủ xanh',
    reason: 'Đã có "Đu đủ xanh" trong DB'
  },
  {
    pendingCode: 'do-chua-ie01z',
    pendingName: 'Đồ chua',
    targetActiveCode: 'ca-rot-4rcfv',
    targetActiveName: 'Cà rốt',
    reason: 'Quy về Cà rốt làm đồ chua trong DB'
  },
  {
    pendingCode: 'rau-cu-luoc-an-kho-quet-dau-bap-ca-rot-su-su-6f9yf',
    pendingName: 'Rau củ luộc ăn kho quẹt (Đậu bắp, cà rốt, su su)',
    targetActiveCode: 'dau-bap-9shx0',
    targetActiveName: 'Đậu bắp',
    reason: 'Nguyên liệu ghép dài, quy về "Đậu bắp" trong DB'
  },
  {
    pendingCode: 'bi-heo-tron-thinh-gao-04aqb',
    pendingName: 'Bì heo trộn thính gạo',
    targetActiveCode: 'da-heo-i8l22',
    targetActiveName: 'Da heo',
    reason: '"Da heo" trong DB đã có sẵn hình ảnh Bì heo Vissan thái sợi'
  },
  {
    pendingCode: 'thit-ma-dau-heo-tah6a',
    pendingName: 'Thịt má đầu heo',
    targetActiveCode: 'ING-3D9F30',
    targetActiveName: 'Thịt nọng heo',
    reason: 'Thịt má đầu heo chính là "Thịt nọng heo" (pork jowl) trong DB'
  },
  {
    pendingCode: 'la-dong-goi-banh-tuoi-wowmt',
    pendingName: 'Lá dong gói bánh tươi',
    targetActiveCode: 'la-chuoi-0cgd1',
    targetActiveName: 'Lá chuối',
    reason: 'Bánh nậm Huế gói bằng lá chuối truyền thống, đã có "Lá chuối" trong DB'
  },
  {
    pendingCode: 'soi-banh-canh-bot-loc-mzaqg',
    pendingName: 'Sợi bánh canh bột lọc',
    targetActiveCode: 'bot-nang-e3ptf',
    targetActiveName: 'Bột năng',
    reason: 'Quy về "Bột năng" làm sợi bánh canh lọc trong DB'
  },
  {
    pendingCode: 'hu-tieu-dai-iksax',
    pendingName: 'Hủ tiếu dai',
    targetActiveCode: 'hu-tieu-nam-vang-18-x-wp0iw',
    targetActiveName: 'Hủ tiếu Nam Vang 18 x',
    reason: 'Đã có sản phẩm "Hủ tiếu Nam Vang" trong DB'
  }
];

async function main() {
  console.log(`=== BẮT ĐẦU CHUẨN HÓA VÀ HỢP NHẤT ĐỢT 2 (${SECOND_ROUND_MAP.length} MỤC) ===\n`);

  let mergedCount = 0;
  let remappedDishCount = 0;

  for (let i = 0; i < SECOND_ROUND_MAP.length; i++) {
    const item = SECOND_ROUND_MAP[i];
    const pendingItem = await prisma.ingredient.findFirst({
      where: { code: item.pendingCode, status: 'PENDING_REVIEW' },
      include: {
        dishIngredients: {
          include: { dish: { select: { name: true } } }
        }
      }
    });

    const targetItem = await prisma.ingredient.findFirst({
      where: { code: item.targetActiveCode, isActive: true }
    });

    if (!pendingItem) {
      console.log(`⚠️ Bỏ qua [${item.pendingCode}] vì không còn trong hàng đợi pending.`);
      continue;
    }
    if (!targetItem) {
      console.log(`❌ Lỗi: Target active [${item.targetActiveCode}] không tìm thấy.`);
      continue;
    }

    const dishNames = pendingItem.dishIngredients.map(di => di.dish.name);
    console.log(`🔄 [${i + 1}/${SECOND_ROUND_MAP.length}] Xử lý: "${pendingItem.name}" (${pendingItem.code})`);
    console.log(`   👉 Chuyển sang Active: "${targetItem.name}" (${targetItem.code})`);
    console.log(`   📝 Lý do: ${item.reason}`);
    console.log(`   🍽️ Các món bị ảnh hưởng (${dishNames.length}): ${dishNames.join(', ')}`);

    // Update DishIngredient references
    for (const di of pendingItem.dishIngredients) {
      await prisma.dishIngredient.update({
        where: { id: di.id },
        data: {
          ingredientId: targetItem.id,
          parsedName: targetItem.name,
          needsReview: false,
          resolutionConfidence: 100,
        }
      });
      remappedDishCount++;
    }

    // Clean up relations
    await prisma.ingredientImageCandidate.deleteMany({
      where: { ingredientId: pendingItem.id }
    });

    await prisma.userAvoidedIngredient.deleteMany({
      where: { ingredientId: pendingItem.id }
    });

    // Delete the pending ingredient
    await prisma.ingredient.delete({
      where: { id: pendingItem.id }
    });

    mergedCount++;
    console.log(`   ✅ Đã hợp nhất và xóa khỏi hàng đợi duyệt.\n`);
  }

  const remainingPending = await prisma.ingredient.count({
    where: { status: 'PENDING_REVIEW' }
  });

  const totalActive = await prisma.ingredient.count({
    where: { isActive: true }
  });

  console.log(`======================================================`);
  console.log(`TỔNG KẾT ĐỢT 2 CHUẨN HÓA NGUYÊN LIỆU:`);
  console.log(`- Đã hợp nhất thêm vào Active: ${mergedCount} nguyên liệu`);
  console.log(`- Số lượt DishIngredient được cập nhật: ${remappedDishCount}`);
  console.log(`- Tổng số Active trong DB: ${totalActive}`);
  console.log(`- Số nguyên liệu đặc thù CẦN DUYỆT còn lại: ${remainingPending} mục`);
  console.log(`======================================================`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
