/**
 * import-60-saigon-dishes.ts
 *
 * Tự động thêm 60 món ăn phổ biến ở Sài Gòn bằng pipeline AI Import (ImportJobsService).
 * Quy chuẩn:
 *  - Khẩu phần mặc định: 1
 *  - Nguyên liệu đối chiếu với kho 715 nguyên liệu chuẩn, không tạo nguyên liệu rác
 *  - Tự động tính dinh dưỡng chuẩn (VFCT 2007 / USDA)
 *  - Lưu bản nháp (DRAFT) với đầy đủ bước nấu, gia vị, hình ảnh
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { ImportJobsService } from '../src/ai-import/import-jobs.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { SystemRole } from '@prisma/client';

export interface DishToImport {
  name: string;
  regionHint: 'south';
  relatedKeywords: string[];
}

export const SAIGON_DISHES: DishToImport[] = [
  // ── 1. Cơm & Xôi ──────────────────────────────────────────────────────────
  {
    name: 'Cơm tấm sườn bì chả',
    regionHint: 'south',
    relatedKeywords: ['cơm tấm sườn nướng', 'bì heo thính', 'chả trứng hấp', 'cơm tấm Sài Gòn'],
  },
  {
    name: 'Cơm tấm ba rọi nướng',
    regionHint: 'south',
    relatedKeywords: ['cơm tấm thịt ba chỉ nướng', 'cơm tấm mỡ hành', 'nước mắm chua ngọt Sài Gòn'],
  },
  {
    name: 'Cơm tấm sườn nướng',
    regionHint: 'south',
    relatedKeywords: ['cơm tấm sườn cốt lết', 'sườn nướng mỡ hành', 'cơm tấm đêm Sài Gòn'],
  },
  {
    name: 'Cơm tấm chả trứng',
    regionHint: 'south',
    relatedKeywords: ['chả trứng chưng thịt cua', 'cơm tấm Sài Gòn', 'chả hấp trứng muối'],
  },
  {
    name: 'Cơm chiên Dương Châu',
    regionHint: 'south',
    relatedKeywords: ['cơm chiên lạp xưởng tôm thịt', 'cơm rang Dương Châu', 'ẩm thực Chợ Lớn'],
  },
  {
    name: 'Cơm cháy kho quẹt',
    regionHint: 'south',
    relatedKeywords: ['kho quẹt tôm khô thịt mỡ', 'cơm cháy đáy nồi', 'rau luộc kho quẹt'],
  },
  {
    name: 'Cơm gà xối mỡ',
    regionHint: 'south',
    relatedKeywords: ['cơm chiên da gà giòn', 'đùi gà xối mỡ tỏi ớt', 'cơm gà Sài Gòn'],
  },
  {
    name: 'Xôi mặn Sài Gòn',
    regionHint: 'south',
    relatedKeywords: ['xôi lạp xưởng chà bông', 'xôi pate mỡ hành', 'xôi mặn thập cẩm'],
  },
  {
    name: 'Xôi gà xé mỡ hành',
    regionHint: 'south',
    relatedKeywords: ['xôi nếp gà luộc xé', 'xôi gà mỡ hành tỏi phi', 'xôi gà Sài Gòn'],
  },

  // ── 2. Hủ tiếu & Mì Chợ Lớn ──────────────────────────────────────────────
  {
    name: 'Hủ tiếu Nam Vang',
    regionHint: 'south',
    relatedKeywords: ['hủ tiếu khô Nam Vang', 'hủ tiếu tôm thịt trứng cút', 'nước lèo xương ống'],
  },
  {
    name: 'Hủ tiếu gõ',
    regionHint: 'south',
    relatedKeywords: ['hủ tiếu mì gõ vỉa hè', 'hủ tiếu xương bò viên', 'hủ tiếu đêm Sài Gòn'],
  },
  {
    name: 'Hủ tiếu bò kho',
    regionHint: 'south',
    relatedKeywords: ['bò kho hủ tiếu mềm', 'bò kho húng quế ngò gai', 'hủ tiếu bò kho Sài Gòn'],
  },
  {
    name: 'Hủ tiếu mì thập cẩm',
    regionHint: 'south',
    relatedKeywords: ['hủ tiếu mì sườn xá xíu', 'hủ tiếu mì Chợ Lớn', 'hủ tiếu nước lèo tôm mực'],
  },
  {
    name: 'Hủ tiếu sa tế bò',
    regionHint: 'south',
    relatedKeywords: ['hủ tiếu sa tế người Hoa', 'bò sa tế đậu phộng', 'hủ tiếu sa tế Chợ Lớn'],
  },
  {
    name: 'Hủ tiếu mực',
    regionHint: 'south',
    relatedKeywords: ['hủ tiếu mực tươi ngọt', 'hủ tiếu mực thịt băm', 'hủ tiếu mực Sài Gòn'],
  },
  {
    name: 'Hủ tiếu sườn non',
    regionHint: 'south',
    relatedKeywords: ['hủ tiếu sườn củ cải', 'hủ tiếu nước trong', 'sườn heo hầm hủ tiếu'],
  },
  {
    name: 'Mì vịt tiềm Chợ Lớn',
    regionHint: 'south',
    relatedKeywords: ['mì vịt tiềm thuốc bắc', 'đùi vịt tiềm nấm đông cô', 'mì sợi vàng Chợ Lớn'],
  },
  {
    name: 'Mì xào giòn hải sản',
    regionHint: 'south',
    relatedKeywords: ['mì chiên giòn sốt hải sản', 'mì xào giòn rau củ thập cẩm', 'ẩm thực Trung Hoa Sài Gòn'],
  },
  {
    name: 'Sủi cảo tôm thịt Hà Tôn Quyền',
    regionHint: 'south',
    relatedKeywords: ['sủi cảo tôm mực khô', 'sủi cảo thập cẩm sốt dầu hào', 'phố sủi cảo quận 11'],
  },

  // ── 3. Bánh mì Sài Gòn ────────────────────────────────────────────────────
  {
    name: 'Bánh mì thịt nguội pate Sài Gòn',
    regionHint: 'south',
    relatedKeywords: ['bánh mì kẹp chả lụa pate bơ', 'bánh mì đặc ruột đồ chua', 'bánh mì truyền thống Sài Gòn'],
  },
  {
    name: 'Bánh mì xíu mại trứng muối',
    regionHint: 'south',
    relatedKeywords: ['xíu mại sốt cà chua', 'bánh mì viên xíu mại trứng muối', 'bánh mì xíu mại Sài Gòn'],
  },
  {
    name: 'Bánh mì chảo Sài Gòn',
    regionHint: 'south',
    relatedKeywords: ['bánh mì chảo bò né trứng ốp la', 'pate xúc xích phô mai', 'bánh mì chảo buổi sáng'],
  },
  {
    name: 'Bánh mì phá lấu bò',
    regionHint: 'south',
    relatedKeywords: ['phá lấu bánh mì kẹp', 'phá lấu tai mũi lòng bò nước dừa', 'bánh mì phá lấu Sài Gòn'],
  },
  {
    name: 'Bánh mì heo quay',
    regionHint: 'south',
    relatedKeywords: ['bánh mì thịt heo quay da giòn', 'nước sốt heo quay dưa leo', 'bánh mì heo quay Sài Gòn'],
  },
  {
    name: 'Bánh mì chả cá',
    regionHint: 'south',
    relatedKeywords: ['bánh mì chả cá chiên nóng', 'chả cá rau răm ớt tươi', 'bánh mì chả cá sợi'],
  },

  // ── 4. Bún & Bánh canh ────────────────────────────────────────────────────
  {
    name: 'Bún mắm Sài Gòn',
    regionHint: 'south',
    relatedKeywords: ['bún mắm tôm mực thịt quay', 'cà tím ớt nhồi chả cá', 'bún mắm miền Tây tại Sài Gòn'],
  },
  {
    name: 'Bún thịt nướng chả giò',
    regionHint: 'south',
    relatedKeywords: ['bún thịt nướng sả ớt', 'chả giò tôm thịt giòn rụm', 'nước mắm đậu phộng mỡ hành'],
  },
  {
    name: 'Bún riêu cua ốc Sài Gòn',
    regionHint: 'south',
    relatedKeywords: ['bún riêu cua đồng ốc bươu', 'đậu hũ chiên huyết heo chả lụa', 'riêu cua cà chua'],
  },
  {
    name: 'Bún bò xào Nam Bộ',
    regionHint: 'south',
    relatedKeywords: ['bún bò xào hành tây sả', 'rau sống giá đỗ đậu phộng', 'nước mắm chua ngọt'],
  },
  {
    name: 'Bánh canh cua giò heo',
    regionHint: 'south',
    relatedKeywords: ['bánh canh cua nước sệt', 'thịt cua biển giò heo huyết', 'bánh canh bột lọc cua'],
  },
  {
    name: 'Bánh canh ghẹ',
    regionHint: 'south',
    relatedKeywords: ['bánh canh ghẹ nguyên con', 'nước dùng ghẹ ngọt thanh', 'bánh canh ghẹ muối ớt xanh'],
  },
  {
    name: 'Bánh canh Trảng Bàng',
    regionHint: 'south',
    relatedKeywords: ['bánh canh giò heo nước trong', 'thịt bắp heo luộc bánh tráng', 'đặc sản bánh canh gần Sài Gòn'],
  },

  // ── 5. Món cuốn & Ăn vặt đường phố ─────────────────────────────────────────
  {
    name: 'Gỏi cuốn tôm thịt',
    regionHint: 'south',
    relatedKeywords: ['bánh tráng cuốn tôm sú thịt ba chỉ', 'bún hẹ tương đen đậu phộng', 'gỏi cuốn thanh mát'],
  },
  {
    name: 'Bì cuốn chấm nước mắm',
    regionHint: 'south',
    relatedKeywords: ['bì heo trộn thính gạo', 'thịt nạc heo rau thơm', 'nước mắm tỏi ớt chua ngọt'],
  },
  {
    name: 'Bánh tráng trộn Sài Gòn',
    regionHint: 'south',
    relatedKeywords: ['bánh tráng khô bò muối tôm', 'trứng cút rau răm sốt me bò', 'ăn vặt đường phố Sài Gòn'],
  },
  {
    name: 'Bánh tráng nướng Sài Gòn',
    regionHint: 'south',
    relatedKeywords: ['bánh tráng nướng trứng cút tép khô', 'hành phi phô mai xúc xích', 'pizza Việt Nam'],
  },
  {
    name: 'Bột chiên trứng Sài Gòn',
    regionHint: 'south',
    relatedKeywords: ['bột chiên giòn trứng gà', 'đu đủ bào sợi nước tương đen', 'bột chiên Chợ Lớn'],
  },
  {
    name: 'Bánh xèo miền Nam',
    regionHint: 'south',
    relatedKeywords: ['bánh xèo vàng giòn tôm thịt', 'giá đỗ đậu xanh củ sắn', 'rau rừng bánh xèo'],
  },
  {
    name: 'Bánh khọt tôm nước cốt dừa',
    regionHint: 'south',
    relatedKeywords: ['bánh khọt giòn rụm tôm tươi', 'nước cốt dừa béo ngậy mỡ hành', 'bánh khọt miền Nam'],
  },
  {
    name: 'Bắp xào bơ tôm khô',
    regionHint: 'south',
    relatedKeywords: ['bắp ngọt xào bơ lạt tép khô', 'hành lá tiêu xay tương ớt', 'ăn vặt hồ con rùa'],
  },
  {
    name: 'Chả giò rế tôm thịt',
    regionHint: 'south',
    relatedKeywords: ['chả ram rế giòn rụm', 'tôm thịt băm khoai môn', 'chả giò chiên Sài Gòn'],
  },
  {
    name: 'Phá lấu lòng bò nước dừa',
    regionHint: 'south',
    relatedKeywords: ['phá lấu lá xách tổ ong khăn lông', 'nước dừa tươi hoa hồi thảo quả', 'nước mắm me chấm phá lấu'],
  },
  {
    name: 'Bò lá lốt bánh hỏi',
    regionHint: 'south',
    relatedKeywords: ['thịt bò cuộn lá lốt nướng than', 'bánh hỏi mỡ hành đậu phộng', 'mắm nêm chấm bò lá lốt'],
  },
  {
    name: 'Bò né hoa mai ốp la pate',
    regionHint: 'south',
    relatedKeywords: ['thịt bò mềm bơ thơm áp chảo gang', 'trứng gà ốp la pate hành tây', 'bánh mì bò né Sài Gòn'],
  },
  {
    name: 'Súp cua óc heo trứng bắc thảo',
    regionHint: 'south',
    relatedKeywords: ['súp cua nấm đông cô trứng cút', 'óc heo bùi béo trứng bắc thảo', 'súp cua chợ Thiếc'],
  },
  {
    name: 'Càng ghẹ rang muối ớt',
    regionHint: 'south',
    relatedKeywords: ['càng ghẹ rang muối tuyết', 'muối ớt đỏ cay nồng', 'quán ốc Sài Gòn'],
  },
  {
    name: 'Ốc hương xào bơ tỏi',
    regionHint: 'south',
    relatedKeywords: ['ốc hương xào bơ béo ngậy', 'tỏi phi giòn chấm bánh mì', 'món ốc đêm Sài Gòn'],
  },
  {
    name: 'Sò huyết xào me',
    regionHint: 'south',
    relatedKeywords: ['sò huyết sốt me chua ngọt', 'đậu phộng rang rau răm', 'ốc đêm vỉa hè Sài Gòn'],
  },
  {
    name: 'Cút lộn xào me',
    regionHint: 'south',
    relatedKeywords: ['trứng cút lộn sốt me chua cay', 'hành phi rau răm đậu phộng', 'ăn vặt Sài Gòn'],
  },

  // ── 6. Canh, Kho, Lẩu Nam Bộ ──────────────────────────────────────────────
  {
    name: 'Canh chua cá lóc Nam Bộ',
    regionHint: 'south',
    relatedKeywords: ['canh chua cá quả miền Tây', 'bạc hà cà chua đậu bắp thơm me', 'ngò gai ngò ôm'],
  },
  {
    name: 'Cá lóc kho tộ Nam Bộ',
    regionHint: 'south',
    relatedKeywords: ['cá lóc kho nồi đất', 'nước dừa tươi tiêu ớt nước màu', 'cá kho đậm đà đưa cơm'],
  },
  {
    name: 'Thịt kho tàu nước dừa',
    regionHint: 'south',
    relatedKeywords: ['thịt ba rọi kho nước dừa xiêm', 'trứng vịt luộc thịt mềm tan', 'món tết truyền thống Nam Bộ'],
  },
  {
    name: 'Canh khổ qua dồn thịt',
    regionHint: 'south',
    relatedKeywords: ['mướp đắng nhồi thịt nạc miến nấm mèo', 'canh giải nhiệt ngày hè', 'canh khổ qua thanh mát'],
  },
  {
    name: 'Canh khoai mỡ tôm thịt',
    regionHint: 'south',
    relatedKeywords: ['khoai mỡ tím nạo nhuyễn', 'tôm đất băm ngò gai ngò om', 'canh khoai mỡ Nam Bộ'],
  },
  {
    name: 'Lẩu cá kèo lá giang',
    regionHint: 'south',
    relatedKeywords: ['cá kèo tươi sống lá giang chua thanh', 'rau đắng hoa chuối bún tươi', 'đặc sản lẩu Sài Gòn'],
  },
  {
    name: 'Lẩu mắm Nam Bộ',
    regionHint: 'south',
    relatedKeywords: ['lẩu mắm cá linh cá sặc', 'tôm cá mực cà tím bông súng', 'rau đắng rau nhút'],
  },
  {
    name: 'Lẩu bò sa tế Sài Gòn',
    regionHint: 'south',
    relatedKeywords: ['lẩu đuôi bò nạm bò sa tế', 'khoai môn tàu hũ ky rau cải xoong', 'chao chấm lẩu bò'],
  },

  // ── 7. Chè & Tráng miệng Sài Gòn ──────────────────────────────────────────
  {
    name: 'Chè bà ba Nam Bộ',
    regionHint: 'south',
    relatedKeywords: ['chè thưng khoai lang khoai mì hạt sen', 'nước cốt dừa bột báng đậu xanh', 'chè truyền thống Nam Bộ'],
  },
  {
    name: 'Sâm bổ lượng Chợ Lớn',
    regionHint: 'south',
    relatedKeywords: ['sâm bổ lượng thanh nhiệt', 'nhãn nhục hạt sen táo đỏ bo bo rong biển', 'chè sâm người Hoa'],
  },
  {
    name: 'Bánh flan cà phê cốt dừa',
    regionHint: 'south',
    relatedKeywords: ['bánh flan trứng sữa caramel mềm mịn', 'cà phê đen đá nước cốt dừa', 'tráng miệng Sài Gòn'],
  },
  {
    name: 'Chè bưởi Sài Gòn',
    regionHint: 'south',
    relatedKeywords: ['cùi bưởi giòn không đắng đậu xanh', 'nước cốt dừa thơm béo bột năng', 'chè bưởi nước cốt dừa'],
  },
];

async function main() {
  const logger = new Logger('SaigonImportBatch');
  logger.log(`=== BẮT ĐẦU TỰ ĐỘNG THÊM 60 MÓN ĂN SÀI GÒN BẰNG CHỨC NĂNG TỰ ĐỘNG NHẬP MÓN ===`);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const prisma = app.get(PrismaService);
  const jobs = app.get(ImportJobsService);

  // 1. Lấy thông tin tài khoản admin
  const admins = await prisma.db.$queryRaw<Array<{ user_id: string; display_name: string | null }>>`
    SELECT p.user_id, p.display_name
    FROM profile_roles pr
    JOIN profiles p ON p.id = pr.profile_id
    WHERE pr.role::text IN (${SystemRole.SUPER_ADMIN}, ${SystemRole.CONTENT_ADMIN})
    ORDER BY (pr.role::text = ${SystemRole.SUPER_ADMIN}) DESC
    LIMIT 1
  `;
  const admin = admins[0] ? { userId: admins[0].user_id, displayName: admins[0].display_name } : null;
  if (!admin) throw new Error('Không tìm thấy tài khoản admin hợp lệ.');
  logger.log(`Actor: ${admin.displayName ?? admin.userId}`);

  // 2. Lấy danh sách món hiện có trong DB để tránh trùng
  const existingDishes = await prisma.db.dish.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, slug: true, status: true },
  });
  const existingNames = new Set(existingDishes.map((d) => d.name.toLowerCase().trim()));
  logger.log(`Hiện có trong DB: ${existingDishes.length} món.`);

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;
  const createdDishIds: string[] = [];

  for (let i = 0; i < SAIGON_DISHES.length; i++) {
    const item = SAIGON_DISHES[i];
    const indexStr = `[${i + 1}/${SAIGON_DISHES.length}]`;

    if (existingNames.has(item.name.toLowerCase().trim())) {
      logger.log(`${indexStr} ⏭️ Món "${item.name}" đã tồn tại trong DB, bỏ qua.`);
      skipCount++;
      continue;
    }

    logger.log(`\n${indexStr} 🚀 Đang tự động nhập: "${item.name}"...`);
    const startTime = Date.now();

    try {
      // Gọi service tự động nhập món giống hệt Admin UI
      const job = await jobs.create(
        {
          query: item.name,
          regionHint: item.regionHint,
          relatedKeywords: item.relatedKeywords,
          sourceTypes: ['AI_GENERATED'],
        } as any,
        admin.userId,
      );

      // Chờ hoàn thành pipeline
      let currentJob = job;
      const jobTimeout = 4 * 60_000; // tối đa 4 phút
      while (!['DONE', 'FAILED', 'CANCELLED'].includes(currentJob.status)) {
        if (Date.now() - startTime > jobTimeout) {
          throw new Error('Pipeline quá thời gian cho phép (timeout)');
        }
        await new Promise((r) => setTimeout(r, 2_000));
        currentJob = await jobs.findOne(job.id);
        const msg = currentJob.currentStepMessage ? ` - ${currentJob.currentStepMessage}` : '';
        process.stdout.write(`\r   ${indexStr} Tiến độ: [${currentJob.status}] ${currentJob.progress}%${msg}`.padEnd(110));
      }
      process.stdout.write('\n');

      if (currentJob.status !== 'DONE' || !currentJob.resultDishId) {
        throw new Error(currentJob.errorMessage ?? `Trạng thái kết thúc: ${currentJob.status}`);
      }

      const dishId = currentJob.resultDishId;
      createdDishIds.push(dishId);
      existingNames.add(item.name.toLowerCase().trim());
      successCount++;

      const durationSec = Math.round((Date.now() - startTime) / 1000);
      logger.log(`${indexStr} ✅ Thành công: "${item.name}" (${durationSec}s) -> Dish ID: ${dishId}`);
    } catch (err: any) {
      failCount++;
      logger.error(`${indexStr} ❌ Lỗi nhập món "${item.name}": ${err.message}`);
    }
  }

  // 3. Tổng kết
  const totalDishes = await prisma.db.dish.count({ where: { deletedAt: null } });
  logger.log('\n================ TỔNG KẾT NHẬP MÓN SÀI GÒN ================');
  logger.log(`• Thành công: ${successCount}`);
  logger.log(`• Đã có sẵn (bỏ qua): ${skipCount}`);
  logger.log(`• Thất bại: ${failCount}`);
  logger.log(`• Tổng số món hiện có trong database: ${totalDishes}`);
  logger.log('===========================================================\n');

  await app.close();
}

main().catch(console.error);
