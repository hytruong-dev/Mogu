/**
 * batch-ai-import-30-dishes-round-3.ts
 *
 * Tự động nhập thêm 30 món ăn Việt Nam mới (Đợt 3) bằng AI Import pipeline (ImportJobsService).
 * Mỗi món sẽ được:
 *  1. AI tìm kiếm công thức, nguyên liệu và thông tin ẩm thực uy tín
 *  2. Trích xuất nguyên liệu, định lượng, bước nấu, video YouTube
 *  3. Tính toán dinh dưỡng (VFCT 2007 / USDA)
 *  4. Tìm ảnh đại diện và ảnh từng bước thực hiện
 *  5. Tự động xuất bản (PUBLISHED) và duyệt ảnh (APPROVED)
 *  6. Tự động kết nối với các quán ăn trong hệ thống (ShopeeFood / Google Places)
 *
 * Chạy: cd backend; npx ts-node --transpile-only -r tsconfig-paths/register scripts/batch-ai-import-30-dishes-round-3.ts
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

export const NEW_30_DISHES_ROUND_3: DishToImport[] = [
  // ── Miền Bắc (10 món mới) ───────────────────────────────────────────────────
  {
    name: 'Miến lươn Hà Nội',
    regionHint: 'north',
    relatedKeywords: ['miến lươn giòn Hà Nội', 'miến lươn xào giòn', 'miến lươn nước ngọt thanh'],
  },
  {
    name: 'Cơm rang dưa bò',
    regionHint: 'north',
    relatedKeywords: ['cơm rang dưa bò Hà Nội', 'cơm chiên dưa chua thịt bò', 'cơm rang giòn dưa bò'],
  },
  {
    name: 'Chả rươi Tứ Kỳ',
    regionHint: 'north',
    relatedKeywords: ['chả rươi vỏ quýt thì là', 'đặc sản rươi Tứ Kỳ Hải Dương', 'chả rươi Hà Nội'],
  },
  {
    name: 'Vịt om sấu',
    regionHint: 'north',
    relatedKeywords: ['vịt om sấu chua thanh', 'vịt om sấu khoai sọ', 'vịt om sấu miền Bắc'],
  },
  {
    name: 'Canh cua mồng tơi cà pháo',
    regionHint: 'north',
    relatedKeywords: ['canh cua mồng tơi rau đay', 'canh riêu cua mồng tơi cà pháo', 'bữa cơm canh cua miền Bắc'],
  },
  {
    name: 'Bánh đúc nóng Hà Nội',
    regionHint: 'north',
    relatedKeywords: ['bánh đúc nóng thịt băm mộc nhĩ', 'bánh đúc nóng phố cổ', 'bánh đúc dẻo quánh'],
  },
  {
    name: 'Thịt đông dưa chua',
    regionHint: 'north',
    relatedKeywords: ['thịt đông chân giò mộc nhĩ', 'thịt đông miền Bắc ăn kèm dưa chua', 'thịt nấu đông Tết'],
  },
  {
    name: 'Cá kho làng Vũ Đại',
    regionHint: 'north',
    relatedKeywords: ['cá trắm đen kho làng Vũ Đại', 'cá kho niêu đất Hà Nam', 'cá kho mục xương Đại Hoàng'],
  },
  {
    name: 'Bún cá rô đồng',
    regionHint: 'north',
    relatedKeywords: ['bún cá rô đồng Hải Dương', 'bún cá rô giòn ngọt rau cải', 'bún cá rô đồng Nam Định'],
  },
  {
    name: 'Phở cuốn Hà Nội',
    regionHint: 'north',
    relatedKeywords: ['phở cuốn ngũ xã', 'phở cuốn thịt bò xào', 'bánh phở cuốn rau thơm thịt bò'],
  },

  // ── Miền Trung & Tây Nguyên (10 món mới) ────────────────────────────────────
  {
    name: 'Gỏi cá mai Nha Trang',
    regionHint: 'central',
    relatedKeywords: ['gỏi cá mai tái chanh Nha Trang', 'gỏi cá mai sốt đậu phộng mè', 'đặc sản gỏi cá mai'],
  },
  {
    name: 'Hến xào xúc bánh tráng',
    regionHint: 'central',
    relatedKeywords: ['hến xào sả ớt miền Trung', 'hến xào xúc bánh đa bánh tráng mè', 'hến xào xúc bánh tráng Huế'],
  },
  {
    name: 'Bánh tráng cuốn thịt heo Đà Nẵng',
    regionHint: 'central',
    relatedKeywords: ['bánh tráng cuốn thịt heo hai đầu da', 'bánh tráng thịt heo chấm mắm nêm', 'bánh tráng cuốn Đà Nẵng'],
  },
  {
    name: 'Bánh ướt thịt nướng Huế',
    regionHint: 'central',
    relatedKeywords: ['bánh ướt thịt nướng Kim Long', 'bánh ướt cuốn thịt nướng tương vừng', 'bánh ướt thịt nướng xứ Huế'],
  },
  {
    name: 'Lẩu cá bớp măng chua',
    regionHint: 'central',
    relatedKeywords: ['lẩu cá bớp măng chua Nha Trang', 'lẩu cá bớp lá giang dứa cà chua', 'lẩu cá bớp miền Trung'],
  },
  {
    name: 'Bánh canh hẹ Phú Yên',
    regionHint: 'central',
    relatedKeywords: ['bánh canh hẹ chả cá Phú Yên', 'bánh canh hẹ Tuy Hòa', 'bánh canh sợi gạo ngập hẹ sẻ'],
  },
  {
    name: 'Cơm lam gà nướng Tây Nguyên',
    regionHint: 'central',
    relatedKeywords: ['gà nướng sa lửa cơm lam Pleiku', 'cơm lam gà nướng Bản Đôn', 'cơm lam gà đồi nướng than'],
  },
  {
    name: 'Bánh hỏi cháo lòng Bình Định',
    regionHint: 'central',
    relatedKeywords: ['bánh hỏi cháo lòng Quy Nhơn', 'bánh hỏi lòng heo mỡ hành', 'đặc sản bánh hỏi Bình Định'],
  },
  {
    name: 'Bánh đập mắm nêm Quảng Nam',
    regionHint: 'central',
    relatedKeywords: ['bánh đập thịt luộc mắm nêm', 'bánh đập giòn dẻo miền Trung', 'bánh đập xúc mắm nêm Hội An'],
  },
  {
    name: 'Cơm gà Tam Kỳ',
    regionHint: 'central',
    relatedKeywords: ['cơm gà Tam Kỳ Quảng Nam', 'cơm gà ta xé phay vàng óng', 'cơm gà Tam Kỳ dưa chua'],
  },

  // ── Miền Nam & Miền Tây (10 món mới) ────────────────────────────────────────
  {
    name: 'Cá lóc nướng trui miền Tây',
    regionHint: 'south',
    relatedKeywords: ['cá lóc đồng nướng trui rơm', 'cá lóc nướng trui cuốn bánh tráng', 'cá lóc nướng chấm mắm me'],
  },
  {
    name: 'Hủ tiếu Sa Đéc',
    regionHint: 'south',
    relatedKeywords: ['hủ tiếu Sa Đéc khô nước sốt đậm đà', 'hủ tiếu bột gạo Sa Đéc Đồng Tháp', 'hủ tiếu Sa Đéc súp ngọt xương'],
  },
  {
    name: 'Lẩu cua đồng miền Tây',
    regionHint: 'south',
    relatedKeywords: ['lẩu cua đồng hải sản miền Tây', 'lẩu riêu cua đồng tôm càng bông súng', 'lẩu cua đồng mồng tơi hột vịt lộn'],
  },
  {
    name: 'Bánh cóng Sóc Trăng',
    regionHint: 'south',
    relatedKeywords: ['bánh cống Sóc Trăng giòn rụm', 'bánh cóng đậu xanh thịt băm tôm đất', 'đặc sản bánh cóng miền Tây'],
  },
  {
    name: 'Bún kèn Kiên Giang',
    regionHint: 'south',
    relatedKeywords: ['bún kèn Phú Quốc Hà Tiên', 'bún kèn nước cốt dừa cá nhồng', 'bún kèn đu đủ bào rau thơm'],
  },
  {
    name: 'Bánh tằm bì nước cốt dừa',
    regionHint: 'south',
    relatedKeywords: ['bánh tằm bì Bạc Liêu', 'bánh tằm sợi to bì heo nước cốt dừa', 'bánh tằm bì mặn ngọt miền Tây'],
  },
  {
    name: 'Bún thịt nướng chả giò Sài Gòn',
    regionHint: 'south',
    relatedKeywords: ['bún thịt nướng chả giò giòn rụm', 'bún thịt nướng Sài Gòn mỡ hành đậu phộng', 'bún thịt nướng nước mắm chua ngọt'],
  },
  {
    name: 'Bánh xèo củ hũ dừa Bến Tre',
    regionHint: 'south',
    relatedKeywords: ['bánh xèo củ hũ dừa tôm thịt', 'bánh xèo giòn rụm xứ dừa Bến Tre', 'bánh xèo nhân củ hũ dừa'],
  },
  {
    name: 'Lẩu vịt nấu chao Cần Thơ',
    regionHint: 'south',
    relatedKeywords: ['lẩu vịt nấu chao Thành Giao', 'lẩu vịt xiêm khoai môn chao đỏ', 'lẩu vịt nấu chao Cần Thơ'],
  },
  {
    name: 'Cá kho tộ miền Tây',
    regionHint: 'south',
    relatedKeywords: ['cá kho tộ nước màu dừa đậm đà', 'cá lóc kho tộ miền Tây', 'cá kho tộ tóp mỡ ớt hiểm'],
  },
];

async function main() {
  const logger = new Logger('BatchAiImportRound3');
  logger.log(`\n======================================================================`);
  logger.log(`🚀 BẮT ĐẦU NHẬP 30 MÓN ĂN MỚI (ĐỢT 3) BẰNG AI IMPORT PIPELINE`);
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

  for (let i = 0; i < NEW_30_DISHES_ROUND_3.length; i++) {
    const item = NEW_30_DISHES_ROUND_3[i];
    const indexStr = `[${i + 1}/${NEW_30_DISHES_ROUND_3.length}]`;

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
  logger.log('\n================ TỔNG KẾT BATCH IMPORT 30 MÓN MỚI (ĐỢT 3) ================');
  logger.log(`• Thành công: ${successCount}`);
  logger.log(`• Bỏ qua (đã có): ${skipCount}`);
  logger.log(`• Thất bại: ${failCount}`);
  logger.log(`• Tổng số món ĐÃ XUẤT BẢN hiện có trong database: ${totalPublished}`);
  logger.log('==========================================================================\n');

  await app.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
