/**
 * batch-ai-import-41-provinces.ts
 *
 * Tự động nhập 41 món đặc sản đại diện cho 41 tỉnh thành còn lại của Việt Nam qua AI Import pipeline (ImportJobsService).
 * Sau khi nhập, tự động:
 *  1. Gán provinceId, regionId, originText chính xác theo địa giới hành chính.
 *  2. Xuất bản món (PUBLISHED) và duyệt ảnh (APPROVED).
 *  3. Chạy DishMatcherService để liên kết các món mới với các quán ăn trong hệ thống.
 *  4. Đối soát đảm bảo 63/63 tỉnh thành Việt Nam đều có ít nhất 1 món đặc sản trứ danh.
 *
 * Chạy: cd backend; npx ts-node --transpile-only -r tsconfig-paths/register scripts/batch-ai-import-41-provinces.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { ImportJobsService } from '../src/ai-import/import-jobs.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { DishMatcherService } from '../src/places/ingest/dish-matcher.service';
import { SystemRole, Prisma } from '@prisma/client';
import { VIETNAM_63_SPECIALTIES, ProvinceSpecialty } from './plan-63-provinces';

async function main() {
  const logger = new Logger('BatchAiImport41Provinces');
  logger.log(`\n======================================================================`);
  logger.log(`🇻🇳 BẮT ĐẦU NHẬP 41 MÓN ĐẶC SẢN ĐẠI DIỆN 41 TỈNH THÀNH CÒN LẠI`);
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

  // 2. Điều chỉnh các món Huế và Hội An cho chuẩn xác
  const hueProvince = await prisma.db.province.findFirst({ where: { code: 'hue' } });
  if (hueProvince) {
    await prisma.db.dish.updateMany({
      where: { name: 'Bánh ướt thịt nướng Huế' },
      data: {
        provinceId: hueProvince.id,
        regionId: hueProvince.regionId,
        originText: hueProvince.name,
      },
    });
  }

  const hoianProvince = await prisma.db.province.findFirst({ where: { code: 'hoian' } });
  if (hoianProvince) {
    await prisma.db.dish.updateMany({
      where: { name: 'Cao lầu Hội An' },
      data: {
        provinceId: hoianProvince.id,
        regionId: hoianProvince.regionId,
        originText: hoianProvince.name,
      },
    });
  }

  // 3. Lấy danh sách các tỉnh thành và món hiện có
  const allProvinces = await prisma.db.province.findMany({
    include: {
      region: true,
      dishes: { where: { deletedAt: null }, select: { id: true, name: true } },
    },
  });
  const provinceMap = new Map(allProvinces.map((p) => [p.code, p]));

  // Lọc 41 món cần nhập từ bảng quy hoạch
  const targetsToImport: ProvinceSpecialty[] = VIETNAM_63_SPECIALTIES.filter((s) => {
    const prov = provinceMap.get(s.provinceCode);
    if (!prov) return false;
    // Nếu tỉnh này chưa có món nào, hoặc món chỉ định chưa có trong DB
    const hasDish = prov.dishes.some(
      (d) => d.name.toLowerCase().trim() === s.dishName.toLowerCase().trim(),
    );
    return !hasDish;
  });

  logger.log(`📋 Số lượng món đặc sản tỉnh thành cần nhập: ${targetsToImport.length} món.\n`);

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;
  const createdDishIds: string[] = [];

  for (let i = 0; i < targetsToImport.length; i++) {
    const item = targetsToImport[i];
    const indexStr = `[${i + 1}/${targetsToImport.length}]`;
    const province = provinceMap.get(item.provinceCode);

    if (!province) {
      logger.warn(`${indexStr} ⚠️ Không tìm thấy provinceCode: ${item.provinceCode}`);
      continue;
    }

    // Kiểm tra xem món này đã tồn tại trong DB chưa
    const existingDish = await prisma.db.dish.findFirst({
      where: {
        deletedAt: null,
        name: { equals: item.dishName, mode: 'insensitive' },
      },
    });

    if (existingDish) {
      logger.log(`${indexStr} ℹ️ Món "${item.dishName}" đã có trong DB (ID: ${existingDish.id}). Cập nhật tỉnh thành...`);
      await prisma.db.dish.update({
        where: { id: existingDish.id },
        data: {
          provinceId: province.id,
          regionId: province.regionId,
          originText: province.name,
          status: 'PUBLISHED',
        },
      });
      skipCount++;
      continue;
    }

    logger.log(`\n${indexStr} 🍲 Đang nhập món: "${item.dishName}" đại diện tỉnh ${province.name} (${province.region.name})...`);
    const startTime = Date.now();

    let retryCount = 0;
    const maxRetries = 1;
    let isImported = false;

    while (retryCount <= maxRetries && !isImported) {
      try {
        if (retryCount > 0) {
          logger.warn(`${indexStr} 🔄 Thử lại lần ${retryCount} cho "${item.dishName}"...`);
        }

        const job = await jobs.create(
          {
            query: item.dishName,
            regionHint: item.regionCode,
            relatedKeywords: item.relatedKeywords,
            sourceTypes: ['AI_GENERATED'],
          } as any,
          admin.userId,
        );

        let currentJob = job;
        const jobTimeout = 5 * 60_000; // 5 phút
        while (!['DONE', 'FAILED', 'CANCELLED'].includes(currentJob.status)) {
          if (Date.now() - startTime > jobTimeout) {
            throw new Error('Pipeline timeout');
          }
          await new Promise((r) => setTimeout(r, 2500));
          currentJob = await jobs.findOne(job.id);
          const msg = currentJob.currentStepMessage ? ` - ${currentJob.currentStepMessage}` : '';
          process.stdout.write(
            `\r   ${indexStr} Tiến độ: [${currentJob.status}] ${currentJob.progress}%${msg}`.padEnd(100),
          );
        }
        process.stdout.write('\n');

        if (currentJob.status !== 'DONE' || !currentJob.resultDishId) {
          throw new Error(currentJob.errorMessage ?? `Pipeline kết thúc với status: ${currentJob.status}`);
        }

        const dishId = currentJob.resultDishId;
        createdDishIds.push(dishId);

        // Xuất bản (PUBLISHED), gán provinceId, regionId, originText và duyệt ảnh
        await prisma.db.dish.update({
          where: { id: dishId },
          data: {
            status: 'PUBLISHED',
            publishedAt: new Date(),
            reviewedAt: new Date(),
            reviewedBy: admin.userId,
            publishVersion: { increment: 1 },
            version: { increment: 1 },
            provinceId: province.id,
            regionId: province.regionId,
            originText: province.name,
          },
        });

        await prisma.db.dishMedia.updateMany({
          where: { dishId },
          data: { moderationStatus: 'APPROVED' },
        });

        successCount++;
        isImported = true;
        const durationSec = Math.round((Date.now() - startTime) / 1000);
        logger.log(
          `${indexStr} ✅ "${item.dishName}" (${province.name}) hoàn tất & xuất bản trong ${durationSec}s (Dish ID: ${dishId})`,
        );
      } catch (err: any) {
        retryCount++;
        if (retryCount > maxRetries) {
          failCount++;
          logger.error(`${indexStr} ❌ Lỗi nhập món "${item.dishName}": ${err.message}`);
        } else {
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    }
  }

  // 4. Ghép quán ăn cho các món mới nhập (DishMatcherService)
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

  // 5. Đối soát lại toàn bộ 63 tỉnh thành
  const finalProvinces = await prisma.db.province.findMany({
    include: {
      region: true,
      dishes: { where: { deletedAt: null }, select: { id: true, name: true } },
    },
    orderBy: [{ region: { code: 'asc' } }, { name: 'asc' }],
  });

  const coveredCount = finalProvinces.filter((p) => p.dishes.length > 0).length;
  const missingProvinces = finalProvinces.filter((p) => p.dishes.length === 0);

  const totalPublished = await prisma.db.dish.count({ where: { status: 'PUBLISHED', deletedAt: null } });

  logger.log('\n================ TỔNG KẾT BATCH IMPORT 41 TỈNH THÀNH ================');
  logger.log(`• Thành công: ${successCount}`);
  logger.log(`• Đã có từ trước (cập nhật tỉnh): ${skipCount}`);
  logger.log(`• Thất bại: ${failCount}`);
  logger.log(`• Tổng số món ĐÃ XUẤT BẢN hiện có: ${totalPublished}`);
  logger.log(`• Độ phủ tỉnh thành: ${coveredCount}/${finalProvinces.length} (Tất cả 63 tỉnh thành)`);
  if (missingProvinces.length > 0) {
    logger.warn(`• Tỉnh còn thiếu món: ${missingProvinces.map((p) => p.name).join(', ')}`);
  } else {
    logger.log(`🎉 HOÀN THÀNH 100% ĐỘ PHỦ: Tất cả các tỉnh thành Việt Nam đều đã có món đặc sản trứ danh!`);
  }
  logger.log('======================================================================\n');

  await app.close();
}

main().catch((err) => {
  console.error('Fatal error in batch-ai-import-41-provinces:', err);
  process.exit(1);
});
