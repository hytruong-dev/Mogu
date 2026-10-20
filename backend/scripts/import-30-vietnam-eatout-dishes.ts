/**
 * import-30-vietnam-eatout-dishes.ts
 *
 * Tự động nhập 30 món ăn Việt Nam ăn tiệm / đặt đồ ăn bằng AI Import Pipeline (ImportJobsService).
 * Mỗi món:
 *  1. AI tìm kiếm công thức, trích xuất nguyên liệu, công thức nấu chuẩn cho 1 khẩu phần.
 *  2. Đối chiếu từ điển nguyên liệu gốc.
 *  3. Tính toán dinh dưỡng (VFCT 2007 / USDA).
 *  4. Tìm ảnh bản quyền và kiểm định qua AI Vision.
 *  5. Tự động tính giá nấu nhà (priceMin/Max) và giá ăn tiệm / đặt hàng (dineOutPriceMin/Max).
 *  6. Xuất bản món (PUBLISHED) và duyệt ảnh (APPROVED).
 *  7. Ghép nối tự động với các quán ăn lân cận trong DB (ShopeeFood / Google Places).
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { ImportJobsService } from '../src/ai-import/import-jobs.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { DishMatcherService } from '../src/places/ingest/dish-matcher.service';
import { SystemRole, Prisma } from '@prisma/client';

export interface DishToImport {
  name: string;
  regionHint: 'north' | 'central' | 'south';
  relatedKeywords: string[];
}

export const DISHES_TO_IMPORT: DishToImport[] = [
  // ── Miền Bắc: Món ăn tiệm & đặt món nổi tiếng ──────────────────────────
  {
    name: 'Phở bò',
    regionHint: 'north',
    relatedKeywords: ['phở bò tái nạm', 'phở Hà Nội', 'bánh phở tươi nước dùng bò'],
  },
  {
    name: 'Bún chả Hà Nội',
    regionHint: 'north',
    relatedKeywords: ['bún chả nướng than hoa', 'chả viên chả miếng', 'nước mắm đu đủ cà rốt'],
  },
  {
    name: 'Bún đậu mắm tôm',
    regionHint: 'north',
    relatedKeywords: ['bún lá đậu rán giòn', 'chả cốm nem rán', 'mắm tôm chanh ớt đánh bọt'],
  },
  {
    name: 'Bún riêu cua đồng',
    regionHint: 'north',
    relatedKeywords: ['bún riêu giấm bỗng', 'gạch cua cà chua đậu phụ', 'rau sống hoa chuối'],
  },
  {
    name: 'Chả cá Lã Vọng',
    regionHint: 'north',
    relatedKeywords: ['chả cá lăng thì là', 'mắm tôm bún tươi đậu phộng', 'chả cá Hà Nội'],
  },
  {
    name: 'Bún ốc Hà Nội',
    regionHint: 'north',
    relatedKeywords: ['bún ốc giấm bỗng', 'bún ốc nguội chuối đậu', 'ốc nhồi ốc mít'],
  },
  {
    name: 'Bò sốt vang bánh mì',
    regionHint: 'north',
    relatedKeywords: ['bò sốt vang quế hồi gấc', 'thịt nạm gân bò sốt vang', 'bánh mì giòn sốt vang'],
  },
  {
    name: 'Xôi xéo Hà Nội',
    regionHint: 'north',
    relatedKeywords: ['xôi nếp đỗ xanh bào', 'hành phi mỡ gà', 'ruốc chà bông thịt kho'],
  },
  {
    name: 'Bún mọc sườn chua',
    regionHint: 'north',
    relatedKeywords: ['bún mọc nấm mèo dọc mùng', 'sườn non ninh ngọt', 'nước dùng cà chua thanh mát'],
  },
  {
    name: 'Lẩu riêu cua bắp bò',
    regionHint: 'north',
    relatedKeywords: ['lẩu riêu cua đồng sườn sụn', 'thịt bắp bò hoa nhúng lẩu', 'rau muống hoa chuối'],
  },

  // ── Miền Trung: Đặc sản quán ăn & giao hàng ─────────────────────────────
  {
    name: 'Bún bò Huế',
    regionHint: 'central',
    relatedKeywords: ['bún bò nạm giò gân chả cua', 'nước lèo sả ruốc Huế', 'bún bò cay nồng'],
  },
  {
    name: 'Mì Quảng tôm thịt',
    regionHint: 'central',
    relatedKeywords: ['mì quảng tôm thịt trứng cút', 'bánh tráng mè đậu phộng', 'rau sống mì quảng'],
  },
  {
    name: 'Cơm gà Hội An',
    regionHint: 'central',
    relatedKeywords: ['cơm gà vàng ươm', 'gà ta xé bóp rau răm hành tây', 'nước mạ lòng mề gà'],
  },
  {
    name: 'Cao lầu Hội An',
    regionHint: 'central',
    relatedKeywords: ['sợi cao lầu thịt xíu xá xíu', 'da heo chiên giòn tóp mỡ', 'rau sống Trà Quế'],
  },
  {
    name: 'Bún chả cá Nha Trang',
    regionHint: 'central',
    relatedKeywords: ['chả cá thu cá mối chiên hấp', 'nước dùng cá cờ cà chua thơm', 'bún cá sứa Nha Trang'],
  },
  {
    name: 'Bánh bột lọc Huế',
    regionHint: 'central',
    relatedKeywords: ['bánh bột lọc tôm thịt rim', 'nước mắm ớt cay ngọt', 'bánh bột lọc trần lá chuối'],
  },
  {
    name: 'Bánh bèo chén',
    regionHint: 'central',
    relatedKeywords: ['bánh bèo tôm cháy tóp mỡ', 'mỡ hành chén sành', 'nước mắm ớt pha loãng'],
  },
  {
    name: 'Nem lụi nướng',
    regionHint: 'central',
    relatedKeywords: ['nem lụi nướng sả cây', 'bánh tráng cuốn rau sống', 'nước lèo đậu phộng gan heo'],
  },
  {
    name: 'Bánh căn xíu mại',
    regionHint: 'central',
    relatedKeywords: ['bánh căn trứng cút nướng giòn', 'chén nước mắm xíu mại hành hoa', 'xoài băm rau sống'],
  },
  {
    name: 'Bún sứa Quy Nhơn',
    regionHint: 'central',
    relatedKeywords: ['sứa giòn tươi chả cá thu', 'nước lèo cá ngừ cà chua', 'đặc sản Quy Nhơn Bình Định'],
  },

  // ── Miền Nam: Quán ăn, Cơm văn phòng & Giao đồ ăn cực nhanh ─────────────
  {
    name: 'Cơm tấm sườn bì chả',
    regionHint: 'south',
    relatedKeywords: ['cơm tấm sườn cốt lết nướng than', 'bì heo chả trứng hấp', 'nước mắm mỡ hành Sài Gòn'],
  },
  {
    name: 'Bánh mì thịt nướng',
    regionHint: 'south',
    relatedKeywords: ['bánh mì giòn thịt xiên nướng', 'đồ chua dưa leo ngò rí', 'nước sốt tương đen ớt cay'],
  },
  {
    name: 'Hủ tiếu Nam Vang',
    regionHint: 'south',
    relatedKeywords: ['hủ tiếu khô tôm thịt bằm gan cật', 'nước sốt trộn đậm đà', 'tỏi phi hành lá'],
  },
  {
    name: 'Gỏi cuốn tôm thịt',
    regionHint: 'south',
    relatedKeywords: ['bánh tráng cuộn tôm luộc thịt ba chỉ', 'bún tươi hẹ rau thơm', 'tương đen bơ đậu phộng'],
  },
  {
    name: 'Bò kho bánh mì',
    regionHint: 'south',
    relatedKeywords: ['thịt nạm gân bò hầm cà rốt nước dừa', 'quế hồi sả ớt', 'chấm bánh mì nóng giòn'],
  },
  {
    name: 'Cơm gà xối mỡ',
    regionHint: 'south',
    relatedKeywords: ['đùi gà chiên xối mỡ da giòn rụm', 'cơm chiên đỏ cà chua', 'nước tương tỏi ớt dưa leo'],
  },
  {
    name: 'Cơm bò lúc lắc',
    regionHint: 'south',
    relatedKeywords: ['thịt thăn bò áp chảo bơ tỏi', 'khoai tây chiên hành tây ớt chuông', 'cơm chiên bơ sốt tiêu'],
  },
  {
    name: 'Hủ tiếu Mỹ Tho',
    regionHint: 'south',
    relatedKeywords: ['hủ tiếu dai tôm mực thịt xá xíu', 'nước lèo xương ngọt thanh tỏi phi', 'hủ tiếu Tiền Giang'],
  },
  {
    name: 'Bánh canh ghẹ',
    regionHint: 'south',
    relatedKeywords: ['bánh canh ghẹ nguyên con', 'nước dùng gạch ghẹ sánh đỏ', 'muối tiêu chanh bánh quẩy'],
  },
  {
    name: 'Bánh xèo miền Tây',
    regionHint: 'south',
    relatedKeywords: ['bánh xèo vàng giòn tôm thịt ba rọi', 'giá đỗ đậu xanh', 'cuốn rau cải xanh chấm mắm ngọt'],
  },
];

async function main() {
  const logger = new Logger('AutoImportDishes');
  logger.log(`\n================================================================`);
  logger.log(`=== BẮT ĐẦU TỰ ĐỘNG NHẬP ${DISHES_TO_IMPORT.length} MÓN ĂN VIỆT NAM (ĂN TIỆM / ĐẶT ĐỒ ĂN) ===`);
  logger.log(`================================================================\n`);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const prisma = app.get(PrismaService);
  const jobs = app.get(ImportJobsService);

  // 1. Lấy thông tin tài khoản admin làm actor
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
  logger.log(`Actor thực hiện: ${admin.displayName ?? admin.userId}`);

  // 2. Lấy danh sách món hiện có trong DB để tránh trùng lặp
  const existingDishes = await prisma.db.dish.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, slug: true, status: true },
  });
  const existingNames = new Set(existingDishes.map((d) => d.name.toLowerCase().trim()));
  logger.log(`Hiện tại trong DB có ${existingDishes.length} món (${existingDishes.filter((d) => d.status === 'PUBLISHED').length} đã xuất bản).`);

  const args = process.argv.slice(2);
  const limitArgIdx = args.indexOf('--limit');
  const maxToProcess = limitArgIdx !== -1 ? parseInt(args[limitArgIdx + 1], 10) : 30;

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;
  const createdDishIds: string[] = [];

  for (let i = 0; i < DISHES_TO_IMPORT.length; i++) {
    if (successCount >= maxToProcess) {
      logger.log(`\nĐã đạt hạn mức ${maxToProcess} món mới cho phiên chạy này. Kết thúc sớm.`);
      break;
    }
    const item = DISHES_TO_IMPORT[i];
    const indexStr = `[${i + 1}/${DISHES_TO_IMPORT.length}]`;

    // Nếu món đã có sẵn trong DB (ví dụ món Phở bò vừa tạo thử nghiệm), ta chỉ cần kiểm tra xuất bản
    const existing = existingDishes.find((d) => d.name.toLowerCase().trim() === item.name.toLowerCase().trim());
    if (existing) {
      if (existing.status !== 'PUBLISHED') {
        logger.log(`${indexStr} 🔄 Món "${item.name}" đã có bản nháp, tiến hành xuất bản trực tiếp...`);
        await prisma.db.dish.update({
          where: { id: existing.id },
          data: {
            status: 'PUBLISHED',
            publishedAt: new Date(),
            reviewedAt: new Date(),
            reviewedBy: admin.userId,
            publishVersion: { increment: 1 },
            version: { increment: 1 },
          },
        });
        await prisma.db.dishMedia.updateMany({
          where: { dishId: existing.id },
          data: { moderationStatus: 'APPROVED' },
        });
        createdDishIds.push(existing.id);
        successCount++;
      } else {
        logger.log(`${indexStr} ⏭️ Món "${item.name}" đã tồn tại và đã xuất bản, bỏ qua.`);
        skipCount++;
      }
      continue;
    }

    logger.log(`\n${indexStr} 🚀 Đang tự động nhập: "${item.name}" (${item.regionHint.toUpperCase()})...`);
    const startTime = Date.now();

    try {
      // Tạo job nhập món AI pipeline
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
      const jobTimeout = 5 * 60_000; // tối đa 5 phút mỗi món
      while (!['DONE', 'FAILED', 'CANCELLED'].includes(currentJob.status)) {
        if (Date.now() - startTime > jobTimeout) {
          throw new Error('Pipeline quá thời gian cho phép (timeout)');
        }
        await new Promise((r) => setTimeout(r, 2_500));
        currentJob = await jobs.findOne(job.id);
        const msg = currentJob.currentStepMessage ? ` - ${currentJob.currentStepMessage}` : '';
        process.stdout.write(`\r   ${indexStr} Tiến độ: [${currentJob.status}] ${currentJob.progress}%${msg}`.padEnd(110));
      }
      process.stdout.write('\n');

      if (currentJob.status !== 'DONE' || !currentJob.resultDishId) {
        throw new Error(currentJob.errorMessage ?? `Trạng thái: ${currentJob.status}`);
      }

      const dishId = currentJob.resultDishId;
      createdDishIds.push(dishId);

      // Tự động xuất bản món (PUBLISHED) và duyệt ảnh (APPROVED)
      await prisma.db.dish.update({
        where: { id: dishId },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          reviewedAt: new Date(),
          reviewedBy: admin.userId,
          publishVersion: { increment: 1 },
          version: { increment: 1 },
        },
      });

      await prisma.db.dishMedia.updateMany({
        where: { dishId },
        data: { moderationStatus: 'APPROVED' },
      });

      existingNames.add(item.name.toLowerCase().trim());
      successCount++;
      const durationSec = Math.round((Date.now() - startTime) / 1000);
      logger.log(`   ✅ "${item.name}" hoàn tất & đã xuất bản trong ${durationSec}s (Dish ID: ${dishId})`);

      // Tạm nghỉ 1 giây giữa các món để tránh dồn rate limit
      await new Promise((r) => setTimeout(r, 1_000));
    } catch (err: any) {
      failCount++;
      logger.error(`   ❌ Lỗi nhập món "${item.name}": ${err.message}`);
      // Nếu gặp lỗi rate limit, chờ 5s rồi tiếp tục món tiếp theo
      await new Promise((r) => setTimeout(r, 5_000));
    }
  }

  // 3. Tự động kết nối các món mới thêm với các quán ăn lân cận (ShopeeFood / Google Places)
  if (createdDishIds.length > 0) {
    logger.log('\n🔄 Đang kết nối các món mới tạo với quán ăn trong database (DishMatcherService)...');
    try {
      const matcher = await new DishMatcherService(prisma).loadCatalog();
      const places = await prisma.db.place.findMany({
        select: { id: true, name: true, provider: true },
      });
      logger.log(`Quét qua ${places.length} quán ăn để đối chiếu và ghép món...`);

      let newLinksCount = 0;
      const linksData: Prisma.PlaceDishCreateManyInput[] = [];

      for (const p of places) {
        const matches = matcher.matchPlace(p.name);
        for (const m of matches) {
          if (createdDishIds.includes(m.dishId)) {
            linksData.push({
              placeId: p.id,
              dishId: m.dishId,
              matchStatus: m.status,
              matchScore: new Prisma.Decimal(m.score.toFixed(3)),
              sourceItemName: m.sourceItemName ?? null,
            });
          }
        }
      }

      if (linksData.length > 0) {
        for (let i = 0; i < linksData.length; i += 1000) {
          const chunk = linksData.slice(i, i + 1000);
          const res = await prisma.db.placeDish.createMany({
            data: chunk,
            skipDuplicates: true,
          });
          newLinksCount += res.count;
        }
      }
      logger.log(`✅ Đã tạo thành công ${newLinksCount} liên kết giữa quán ăn và các món mới.`);
    } catch (err: any) {
      logger.warn(`Lỗi ghép quán tự động: ${err.message}`);
    }
  }

  // 4. Tổng kết
  const totalPublished = await prisma.db.dish.count({ where: { status: 'PUBLISHED', deletedAt: null } });
  logger.log('\n================ TỔNG KẾT BATCH IMPORT ================');
  logger.log(`• Món nhập thành công: ${successCount}`);
  logger.log(`• Món bỏ qua (đã có): ${skipCount}`);
  logger.log(`• Thất bại: ${failCount}`);
  logger.log(`• Tổng số món ĐÃ XUẤT BẢN hiện có trong database: ${totalPublished}`);
  logger.log('=======================================================\n');

  await app.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Lỗi thực thi:', err);
  process.exit(1);
});
