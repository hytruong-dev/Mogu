/**
 * batch-ai-import-dishes.ts
 *
 * Chức năng tự động thêm 30 món ăn Việt Nam bằng AI Import pipeline (ImportJobsService).
 * Mỗi món sẽ được:
 *  1. AI tìm kiếm công thức uy tín (VnExpress, Điện máy XANH, Cooky, v.v.)
 *  2. Trích xuất nguyên liệu, định lượng, bước nấu, video YouTube
 *  3. Tính toán dinh dưỡng (VFCT 2007 / USDA)
 *  4. Tìm ảnh đại diện và ảnh từng bước
 *  5. Tự động xuất bản (PUBLISHED) và duyệt ảnh (APPROVED)
 *  6. Tự động kết nối với các quán ăn trong hệ thống (ShopeeFood / Google Maps)
 *
 * Chạy: npx ts-node --transpile-only -r tsconfig-paths/register scripts/batch-ai-import-dishes.ts
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
  // ── Miền Bắc ─────────────────────────────────────────────────────────────
  {
    name: 'Bún thang Hà Nội',
    regionHint: 'north',
    relatedKeywords: ['bún thang', 'đặc sản Hà Nội', 'bún thang truyền thống'],
  },
  {
    name: 'Bún mọc',
    regionHint: 'north',
    relatedKeywords: ['bún mọc dọc mùng', 'bún mọc sườn chua', 'bún mọc Hà Nội'],
  },
  {
    name: 'Chả cá Lã Vọng',
    regionHint: 'north',
    relatedKeywords: ['chả cá Hà Nội', 'chả cá thì là mắm tôm', 'chả cá lăng'],
  },
  {
    name: 'Bún ốc Hà Nội',
    regionHint: 'north',
    relatedKeywords: ['bún ốc giấm bỗng', 'bún ốc chuối đậu', 'bún ốc nguội'],
  },
  {
    name: 'Bò sốt vang',
    regionHint: 'north',
    relatedKeywords: ['thịt bò sốt vang', 'bò sốt vang bánh mì', 'bò sốt vang Hà Nội'],
  },
  {
    name: 'Xôi xéo Hà Nội',
    regionHint: 'north',
    relatedKeywords: ['xôi xéo đỗ xanh mỡ hành', 'xôi xéo chà bông', 'xôi xéo phố cổ'],
  },
  {
    name: 'Lẩu riêu cua bắp bò',
    regionHint: 'north',
    relatedKeywords: ['lẩu riêu cua sườn sụn', 'lẩu riêu cua đồng', 'lẩu bắp bò riêu cua'],
  },
  {
    name: 'Canh sườn nấu sấu',
    regionHint: 'north',
    relatedKeywords: ['canh sườn sấu chua', 'sườn hầm sấu', 'canh chua sấu miền Bắc'],
  },

  // ── Miền Trung ───────────────────────────────────────────────────────────
  {
    name: 'Mì Quảng',
    regionHint: 'central',
    relatedKeywords: ['mì quảng tôm thịt', 'mì quảng gà', 'đặc sản Quảng Nam'],
  },
  {
    name: 'Bánh bột lọc Huế',
    regionHint: 'central',
    relatedKeywords: ['bánh bột lọc gói lá chuối', 'bánh bột lọc tôm thịt', 'đặc sản Huế'],
  },
  {
    name: 'Bánh bèo chén',
    regionHint: 'central',
    relatedKeywords: ['bánh bèo tôm cháy', 'bánh bèo chén miền Trung', 'bánh bèo Huế'],
  },
  {
    name: 'Cơm gà Hội An',
    regionHint: 'central',
    relatedKeywords: ['cơm gà xé', 'gỏi gà rau răm', 'đặc sản Hội An'],
  },
  {
    name: 'Nem lụi Huế',
    regionHint: 'central',
    relatedKeywords: ['nem lụi nướng sả', 'nem lụi cuốn bánh tráng', 'nước lèo nem lụi'],
  },
  {
    name: 'Bún cá Nha Trang',
    regionHint: 'central',
    relatedKeywords: ['bún chả cá Nha Trang', 'bún cá sứa', 'đặc sản Nha Trang'],
  },
  {
    name: 'Bánh căn',
    regionHint: 'central',
    relatedKeywords: ['bánh căn Đà Lạt', 'bánh căn xíu mại', 'bánh căn trứng cút'],
  },
  {
    name: 'Bún sứa Quy Nhơn',
    regionHint: 'central',
    relatedKeywords: ['bún sứa chả cá', 'bún sứa Bình Định', 'đặc sản Quy Nhơn'],
  },
  {
    name: 'Cao lầu Hội An',
    regionHint: 'central',
    relatedKeywords: ['cao lầu thịt xíu', 'mì cao lầu Hội An', 'đặc sản Quảng Nam'],
  },
  {
    name: 'Bánh nậm Huế',
    regionHint: 'central',
    relatedKeywords: ['bánh nậm tôm thịt', 'bánh nậm lá dong', 'bánh nậm xứ Huế'],
  },

  // ── Miền Nam ─────────────────────────────────────────────────────────────
  {
    name: 'Cơm tấm sườn bì chả',
    regionHint: 'south',
    relatedKeywords: ['cơm tấm Sài Gòn', 'cơm tấm sườn nướng', 'chả trứng cơm tấm'],
  },
  {
    name: 'Bánh mì thịt nướng',
    regionHint: 'south',
    relatedKeywords: ['bánh mì kẹp thịt nướng', 'bánh mì Sài Gòn', 'bánh mì xá xíu'],
  },
  {
    name: 'Gỏi cuốn tôm thịt',
    regionHint: 'south',
    relatedKeywords: ['gỏi cuốn', 'bánh tráng cuốn tôm thịt', 'tương đậu phộng gỏi cuốn'],
  },
  {
    name: 'Cá kho tộ',
    regionHint: 'south',
    relatedKeywords: ['cá lóc kho tộ', 'cá kho tiêu nước dừa', 'cá basa kho tộ'],
  },
  {
    name: 'Canh chua cá lóc',
    regionHint: 'south',
    relatedKeywords: ['canh chua miền Tây', 'canh chua cá quả', 'canh chua bạc hà'],
  },
  {
    name: 'Bò kho bánh mì',
    regionHint: 'south',
    relatedKeywords: ['bò kho sả ớt', 'bò kho cà rốt', 'bánh mì bò kho'],
  },
  {
    name: 'Hủ tiếu Mỹ Tho',
    regionHint: 'south',
    relatedKeywords: ['hủ tiếu khô Mỹ Tho', 'hủ tiếu Tiền Giang', 'hủ tiếu tôm thịt'],
  },
  {
    name: 'Cháo lòng',
    regionHint: 'south',
    relatedKeywords: ['cháo lòng heo', 'dồi trường luộc', 'huyết cháo lòng'],
  },
  {
    name: 'Lẩu mắm miền Tây',
    regionHint: 'south',
    relatedKeywords: ['lẩu mắm cá linh cá sặc', 'rau đắng bông súng', 'đặc sản miền Tây'],
  },
  {
    name: 'Cơm cháy kho quẹt',
    regionHint: 'south',
    relatedKeywords: ['kho quẹt tôm khô thịt ba chỉ', 'cơm cháy đáy nồi', 'rau luộc chấm kho quẹt'],
  },
  {
    name: 'Bánh canh ghẹ',
    regionHint: 'south',
    relatedKeywords: ['bánh canh ghẹ nguyên con', 'bánh canh ghẹ miền Nam', 'nước dùng ghẹ'],
  },
  {
    name: 'Bánh xèo miền Tây',
    regionHint: 'south',
    relatedKeywords: ['bánh xèo giòn rụm', 'bánh xèo củ hũ dừa tôm thịt', 'bánh xèo chảo lớn'],
  },
];

async function main() {
  const logger = new Logger('BatchAiImport');
  logger.log(`=== BẮT ĐẦU TỰ ĐỘNG THÊM ${DISHES_TO_IMPORT.length} MÓN ĂN VIỆT NAM BẰNG AI ===`);

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
    select: { id: true, name: true, slug: true, status: true },
  });
  const existingNames = new Set(existingDishes.map((d) => d.name.toLowerCase().trim()));
  logger.log(`Hiện tại trong DB có ${existingDishes.length} món (${existingDishes.filter((d) => d.status === 'PUBLISHED').length} đã xuất bản).`);

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;
  const createdDishIds: string[] = [];

  for (let i = 0; i < DISHES_TO_IMPORT.length; i++) {
    const item = DISHES_TO_IMPORT[i];
    const indexStr = `[${i + 1}/${DISHES_TO_IMPORT.length}]`;

    if (existingNames.has(item.name.toLowerCase().trim())) {
      logger.log(`${indexStr} ⏭️ Món "${item.name}" đã tồn tại trong DB, bỏ qua.`);
      skipCount++;
      continue;
    }

    logger.log(`${indexStr} 🚀 Đang tự động nhập: "${item.name}" (${item.regionHint})...`);
    const startTime = Date.now();

    try {
      // Tạo job nhập món
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
      const jobTimeout = 6 * 60_000; // tối đa 6 phút mỗi món
      while (!['DONE', 'FAILED', 'CANCELLED'].includes(currentJob.status)) {
        if (Date.now() - startTime > jobTimeout) {
          throw new Error('Pipeline quá thời gian cho phép (timeout)');
        }
        await new Promise((r) => setTimeout(r, 3_000));
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
      logger.log(`${indexStr} ✅ "${item.name}" hoàn tất & đã xuất bản trong ${durationSec}s (Dish ID: ${dishId})`);
    } catch (err: any) {
      failCount++;
      logger.error(`${indexStr} ❌ Lỗi nhập món "${item.name}": ${err.message}`);
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
        // Bulk insert từng cụm 1000
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
  const totalPublished = await prisma.db.dish.count({ where: { status: 'PUBLISHED' } });
  logger.log('\n================ TỔNG KẾT BATCH IMPORT ================');
  logger.log(`• Thành công: ${successCount}`);
  logger.log(`• Bỏ qua (đã có): ${skipCount}`);
  logger.log(`• Thất bại: ${failCount}`);
  logger.log(`• Tổng số món ĐÃ XUẤT BẢN hiện có trong database: ${totalPublished}`);
  logger.log('=======================================================\n');

  await app.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
