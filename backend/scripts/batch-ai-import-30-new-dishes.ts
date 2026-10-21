/**
 * batch-ai-import-30-new-dishes.ts
 *
 * Tự động nhập thêm 30 món ăn Việt Nam mới khác nhau bằng AI Import pipeline (ImportJobsService).
 * Mỗi món sẽ được:
 *  1. AI tìm kiếm công thức, nguyên liệu và thông tin ẩm thực uy tín
 *  2. Trích xuất nguyên liệu, định lượng, bước nấu, video YouTube
 *  3. Tính toán dinh dưỡng (VFCT 2007 / USDA)
 *  4. Tìm ảnh đại diện và ảnh từng bước thực hiện
 *  5. Tự động xuất bản (PUBLISHED) và duyệt ảnh (APPROVED)
 *  6. Tự động kết nối với các quán ăn trong hệ thống (ShopeeFood / Google Places)
 *
 * Chạy: cd backend; npx ts-node --transpile-only -r tsconfig-paths/register scripts/batch-ai-import-30-new-dishes.ts
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

export const NEW_30_DISHES_TO_IMPORT: DishToImport[] = [
  // ── Miền Bắc (10 món) ────────────────────────────────────────────────────────
  {
    name: 'Phở gà Hà Nội',
    regionHint: 'north',
    relatedKeywords: ['phở gà ta', 'phở gà Hà Nội', 'phở đùi gà chặt lá chanh'],
  },
  {
    name: 'Bún thang Hà Nội',
    regionHint: 'north',
    relatedKeywords: ['bún thang phố cổ', 'bún thang truyền thống Hà Nội', 'bún thang gà trứng'],
  },
  {
    name: 'Bánh cuốn Thanh Trì',
    regionHint: 'north',
    relatedKeywords: ['bánh cuốn chả quế', 'bánh cuốn Hà Nội', 'bánh cuốn nóng chấm nước mắm'],
  },
  {
    name: 'Nem rán Hà Nội',
    regionHint: 'north',
    relatedKeywords: ['nem rán giòn rụm', 'chả giò Bắc', 'nem rán thịt bún miến mộc nhĩ'],
  },
  {
    name: 'Nộm bò khô Hà Nội',
    regionHint: 'north',
    relatedKeywords: ['nộm bò khô bờ hồ', 'nộm đu đủ thịt bò khô', 'nộm bò khô Hà Nội'],
  },
  {
    name: 'Cháo sườn sụn Hà Nội',
    regionHint: 'north',
    relatedKeywords: ['cháo sườn quẩy', 'cháo sườn sụn rang', 'cháo sườn ngõ huyện'],
  },
  {
    name: 'Lẩu ếch măng cay',
    regionHint: 'north',
    relatedKeywords: ['lẩu ếch xào măng cay', 'lẩu ếch Hà Nội', 'lẩu ếch đồng măng chua'],
  },
  {
    name: 'Bún cá cay Hải Phòng',
    regionHint: 'north',
    relatedKeywords: ['bún cá cay Hải Phòng', 'bún cá rô đồng', 'bún cá cay chả cá'],
  },
  {
    name: 'Bánh đa cua Hải Phòng',
    regionHint: 'north',
    relatedKeywords: ['bánh đa đỏ cua đồng Hải Phòng', 'bánh đa cua bể', 'bánh đa cua chả lá lốt'],
  },
  {
    name: 'Bún ngan cháy tỏi',
    regionHint: 'north',
    relatedKeywords: ['bún ngan cháy tỏi Hà Nội', 'ngan cháy tỏi Hàng Thiếc', 'bún ngan trộn'],
  },

  // ── Miền Trung (10 món) ──────────────────────────────────────────────────────
  {
    name: 'Cơm hến Huế',
    regionHint: 'central',
    relatedKeywords: ['cơm hến xứ Huế', 'cơm hến hoa chuối tóp mỡ', 'đặc sản cơm hến'],
  },
  {
    name: 'Bún hến Huế',
    regionHint: 'central',
    relatedKeywords: ['bún hến nước hến thanh ngọt', 'bún hến cồn Hến', 'bún hến cay miền Trung'],
  },
  {
    name: 'Bánh nậm Huế',
    regionHint: 'central',
    relatedKeywords: ['bánh nậm tôm thịt', 'bánh nậm lá dong', 'bánh nậm xứ Huế'],
  },
  {
    name: 'Bánh ram ít Huế',
    regionHint: 'central',
    relatedKeywords: ['bánh ram ít giòn dẻo', 'bánh ram ít tôm thịt', 'đặc sản bánh ram ít'],
  },
  {
    name: 'Bánh canh cá lóc Huế',
    regionHint: 'central',
    relatedKeywords: ['bánh canh cá lóc bột gạo', 'bánh canh cá lóc Quảng Trị', 'bánh canh cá lóc cay'],
  },
  {
    name: 'Tré Bình Định',
    regionHint: 'central',
    relatedKeywords: ['tré rơm Bình Định', 'tré tai heo tỏi ớt', 'đặc sản tré miền Trung'],
  },
  {
    name: 'Cơm niêu cá bống kho tiêu',
    regionHint: 'central',
    relatedKeywords: ['cơm niêu cá bống sông Trà', 'cá bống kho tiêu Hội An', 'cơm niêu đập giòn'],
  },
  {
    name: 'Bánh xèo tôm nhảy Bình Định',
    regionHint: 'central',
    relatedKeywords: ['bánh xèo tôm nhảy Quy Nhơn', 'bánh xèo tôm đất tươi sống', 'bánh xèo giòn rụm'],
  },
  {
    name: 'Bún mắm nêm Đà Nẵng',
    regionHint: 'central',
    relatedKeywords: ['bún mắm nêm thịt heo quay', 'bún mắm nêm Đà Nẵng', 'bún mắm nêm chả bò'],
  },
  {
    name: 'Lẩu gà lá é Đà Lạt',
    regionHint: 'central',
    relatedKeywords: ['lẩu gà lá é Tao Ngộ', 'lẩu gà lá é Đà Lạt', 'lẩu gà nấm măng cay lá é'],
  },

  // ── Miền Nam & Miền Tây (10 món) ─────────────────────────────────────────────
  {
    name: 'Bún mắm miền Tây',
    regionHint: 'south',
    relatedKeywords: ['bún mắm cá linh cá sặc', 'bún mắm tôm mực thịt quay', 'đặc sản bún mắm'],
  },
  {
    name: 'Bánh canh cua giò heo',
    regionHint: 'south',
    relatedKeywords: ['bánh canh cua giò nạc', 'bánh canh cua nước sệt Sài Gòn', 'bánh canh tôm cua'],
  },
  {
    name: 'Cơm chiên Dương Châu',
    regionHint: 'south',
    relatedKeywords: ['cơm chiên Dương Châu thập cẩm', 'cơm chiên tôm lạp xưởng đậu hà lan', 'cơm chiên vàng'],
  },
  {
    name: 'Lẩu mắm miền Tây',
    regionHint: 'south',
    relatedKeywords: ['lẩu mắm cá linh cá bông lau', 'lẩu mắm rau đồng bông súng', 'đặc sản lẩu mắm'],
  },
  {
    name: 'Cơm cháy kho quẹt',
    regionHint: 'south',
    relatedKeywords: ['kho quẹt tôm khô thịt ba chỉ', 'cơm cháy nồi gang', 'rau củ luộc chấm kho quẹt'],
  },
  {
    name: 'Bánh mì xíu mại',
    regionHint: 'south',
    relatedKeywords: ['bánh mì xíu mại chén', 'bánh mì xíu mại sốt cà chua Sài Gòn', 'xíu mại viên'],
  },
  {
    name: 'Cháo lòng miền Nam',
    regionHint: 'south',
    relatedKeywords: ['cháo lòng heo huyết dồi chiên', 'cháo lòng má heo Sài Gòn', 'cháo lòng thập cẩm'],
  },
  {
    name: 'Bò né trứng ốp la',
    regionHint: 'south',
    relatedKeywords: ['bò né bít tết bánh mì', 'bò né pa tê trứng ốp la', 'bò né chảo gang'],
  },
  {
    name: 'Ốc hương xào bơ tỏi',
    regionHint: 'south',
    relatedKeywords: ['ốc hương sốt bơ tỏi bánh mì', 'ốc hương xào bơ béo ngậy', 'ốc quán Sài Gòn'],
  },
  {
    name: 'Lẩu cá kèo lá giang',
    regionHint: 'south',
    relatedKeywords: ['lẩu cá kèo chua cay lá giang', 'cá kèo tươi miền Tây', 'lẩu cá kèo rau đắng'],
  },
];

async function main() {
  const logger = new Logger('BatchAiImportNew30');
  logger.log(`\n======================================================================`);
  logger.log(`🚀 BẮT ĐẦU NHẬP 30 MÓN ĂN MỚI BẰNG AI IMPORT PIPELINE (ImportJobsService)`);
  logger.log(`======================================================================\n`);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const prisma = app.get(PrismaService);
  const jobs = app.get(ImportJobsService);

  // 1. Lấy profile admin
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
  logger.log(`👤 Actor thực hiện: ${admin.displayName ?? admin.userId}`);

  // 2. Lấy danh sách món hiện có trong DB
  const existingDishes = await prisma.db.dish.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, slug: true, status: true },
  });
  const existingNames = new Set(existingDishes.map((d) => d.name.toLowerCase().trim()));
  logger.log(`📊 Hiện tại trong DB có ${existingDishes.length} món ăn.`);

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;
  const createdDishIds: string[] = [];

  for (let i = 0; i < NEW_30_DISHES_TO_IMPORT.length; i++) {
    const item = NEW_30_DISHES_TO_IMPORT[i];
    const indexStr = `[${i + 1}/${NEW_30_DISHES_TO_IMPORT.length}]`;

    if (existingNames.has(item.name.toLowerCase().trim())) {
      logger.log(`${indexStr} ⏭️ Món "${item.name}" đã tồn tại trong DB, bỏ qua.`);
      skipCount++;
      continue;
    }

    logger.log(`\n${indexStr} 🍳 Đang tự động nhập qua AI: "${item.name}" (Miền ${item.regionHint.toUpperCase()})...`);
    const startTime = Date.now();

    try {
      // Gọi đúng API/service ImportJobsService theo yêu cầu người dùng
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
      const jobTimeout = 5 * 60_000; // 5 phút tối đa
      while (!['DONE', 'FAILED', 'CANCELLED'].includes(currentJob.status)) {
        if (Date.now() - startTime > jobTimeout) {
          throw new Error('Pipeline quá thời gian cho phép (timeout)');
        }
        await new Promise((r) => setTimeout(r, 2500));
        currentJob = await jobs.findOne(job.id);
        const msg = currentJob.currentStepMessage ? ` - ${currentJob.currentStepMessage}` : '';
        process.stdout.write(`\r   ${indexStr} Tiến độ: [${currentJob.status}] ${currentJob.progress}%${msg}`.padEnd(100));
      }
      process.stdout.write('\n');

      if (currentJob.status !== 'DONE' || !currentJob.resultDishId) {
        throw new Error(currentJob.errorMessage ?? `Trạng thái: ${currentJob.status}`);
      }

      const dishId = currentJob.resultDishId;
      createdDishIds.push(dishId);

      // Xuất bản (PUBLISHED) và duyệt ảnh (APPROVED)
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
      logger.log(`${indexStr} ✅ "${item.name}" hoàn tất & đã xuất bản trong ${durationSec}s (Dish ID: ${dishId})`);
    } catch (err: any) {
      failCount++;
      logger.error(`${indexStr} ❌ Lỗi nhập món "${item.name}": ${err.message}`);
    }
  }

  // 3. Tự động liên kết các món mới nhập với quán ăn (DishMatcherService)
  if (createdDishIds.length > 0) {
    logger.log('\n🔄 Đang liên kết các món mới tạo với quán ăn trong database (DishMatcherService)...');
    try {
      const matcher = await new DishMatcherService(prisma).loadCatalog();
      const places = await prisma.db.place.findMany({
        select: { id: true, name: true, provider: true },
      });
      logger.log(`Quét qua ${places.length} quán ăn để ghép món...`);

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
  logger.log('\n================ TỔNG KẾT BATCH IMPORT 30 MÓN MỚI ================');
  logger.log(`• Thành công: ${successCount}`);
  logger.log(`• Bỏ qua (đã có): ${skipCount}`);
  logger.log(`• Thất bại: ${failCount}`);
  logger.log(`• Tổng số món ĐÃ XUẤT BẢN hiện có trong database: ${totalPublished}`);
  logger.log('==================================================================\n');

  await app.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
