/**
 * Smoke E2E cho pipeline AI Import (không qua HTTP/WebSocket).
 *
 *   npx ts-node -r tsconfig-paths/register scripts/smoke-ai-import.ts            # mặc định "Bún bò Huế"
 *   npx ts-node -r tsconfig-paths/register scripts/smoke-ai-import.ts "Mì Quảng"
 *   npx ts-node -r tsconfig-paths/register scripts/smoke-ai-import.ts "Bún bò Huế" --keep   # giữ lại bản nháp
 *
 * Kiểm tra theo plan: Miền Trung/Thừa Thiên Huế, NOODLE + Món nước, 2 khoảng giá,
 * qty >= 1, nutrition method + nguồn, >= 4 bước có ảnh, videoUrl, DishSource.
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { ImportJobsService } from '../src/ai-import/import-jobs.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { SystemRole } from '@prisma/client';
import { isCategoryOf } from '../src/ai-import/classification/dish-category-rules';

const eqCode = (a: string | null | undefined, b: string) => (a ?? '').toUpperCase() === b.toUpperCase();

type Check = { label: string; ok: boolean; detail?: string };

async function main() {
  const args = process.argv.slice(2);
  const keep = args.includes('--keep');
  const query = args.filter((a) => !a.startsWith('--'))[0] ?? 'Bún bò Huế';
  const logger = new Logger('SmokeAiImport');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  const prisma = app.get(PrismaService);
  const jobs = app.get(ImportJobsService);

  // Raw SQL với cast tường minh: pg adapter không cast enum khi lọc text = system_role.
  const admins = await prisma.db.$queryRaw<Array<{ user_id: string; display_name: string | null }>>`
    SELECT p.user_id, p.display_name
    FROM profile_roles pr
    JOIN profiles p ON p.id = pr.profile_id
    WHERE pr.role::text IN (${SystemRole.SUPER_ADMIN}, ${SystemRole.CONTENT_ADMIN})
    ORDER BY (pr.role::text = ${SystemRole.SUPER_ADMIN}) DESC
    LIMIT 1
  `;
  const admin = admins[0] ? { userId: admins[0].user_id, displayName: admins[0].display_name } : null;
  if (!admin) throw new Error('Không tìm thấy profile SUPER_ADMIN/CONTENT_ADMIN để làm actor');
  logger.log(`Actor: ${admin.displayName ?? admin.userId}`);

  const dto = { query, sourceTypes: ['AI_GENERATED'] } as any;
  const job = await jobs.create(dto, admin.userId);
  logger.log(`Job ${job.id} đã tạo cho "${query}" — chờ pipeline...`);

  const started = Date.now();
  let final = job;
  while (!['DONE', 'FAILED', 'CANCELLED'].includes(final.status)) {
    if (Date.now() - started > 6 * 60_000) throw new Error('Pipeline quá 6 phút');
    await new Promise((r) => setTimeout(r, 2_000));
    final = await jobs.findOne(job.id);
    process.stdout.write(`\r  [${final.status}] ${final.progress}% ${final.currentStepMessage ?? ''}`.padEnd(120));
  }
  process.stdout.write('\n');

  for (const log of final.logs ?? []) {
    logger.log(`${log.step.padEnd(12)} ${log.message}${log.detail ? ` — ${log.detail}` : ''}`);
  }

  if (final.status !== 'DONE' || !final.resultDishId) {
    throw new Error(`Pipeline kết thúc với ${final.status}: ${final.errorMessage ?? 'không rõ'}`);
  }

  const dish: any = await prisma.db.dish.findUniqueOrThrow({
    where: { id: final.resultDishId },
    include: {
      region: { select: { code: true, name: true } },
      province: { select: { code: true, name: true } },
      categories: { include: { category: { select: { code: true } } } },
      mealTypes: { include: { mealTypeTag: { select: { code: true } } } },
      dishIngredients: { orderBy: { sortOrder: 'asc' } },
      nutrition: true,
      recipeSteps: { orderBy: { stepOrder: 'asc' } },
      sources: true,
    },
  } as any);

  const categoryCodes: string[] = dish.categories.map((c: any) => c.category.code);
  const stepsWithImage: number = dish.recipeSteps.filter((s: any) => !!s.imageUrl).length;
  const qtyBelowOne: any[] = dish.dishIngredients.filter((i: any) => i.quantity == null || Number(i.quantity) < 1);
  const prov = (dish.nutrition?.provenance ?? null) as any;
  const refs: any[] = Array.isArray(prov?.references) ? prov.references : [];
  const isHue = /hu[eế]/i.test(query);

  const checks: Check[] = [
    { label: 'status DRAFT', ok: dish.status === 'DRAFT', detail: dish.status },
    ...(isHue
      ? [
          { label: 'region = CENTRAL (Miền Trung)', ok: eqCode(dish.region?.code, 'CENTRAL'), detail: `${dish.region?.code} / ${dish.region?.name}` },
          { label: 'province = HUE (Thừa Thiên Huế)', ok: eqCode(dish.province?.code, 'HUE'), detail: `${dish.province?.code} / ${dish.province?.name}` },
          { label: 'category NOODLE (or alias PHO/BUN)', ok: categoryCodes.some((c: string) => isCategoryOf(c, 'NOODLE')), detail: categoryCodes.join(',') },
          { label: 'dishType WET (Món nước)', ok: dish.dishType === 'WET', detail: String(dish.dishType) },
        ]
      : [
          { label: 'region resolved', ok: !!dish.regionId, detail: `${dish.region?.code ?? '-'}` },
          { label: 'category resolved (not empty/OTHER only)', ok: categoryCodes.some((c: string) => !isCategoryOf(c, 'OTHER')), detail: categoryCodes.join(',') },
          { label: 'dishType set', ok: dish.dishType != null, detail: String(dish.dishType) },
        ]),
    { label: 'originText set', ok: !!dish.originText, detail: dish.originText ?? '' },
    { label: 'meal types not empty', ok: dish.mealTypes.length > 0, detail: dish.mealTypes.map((m: any) => m.mealTypeTag.code).join(',') },
    { label: 'home-cook price (priceMin/Max)', ok: dish.priceMin != null && dish.priceMax != null && dish.priceMax >= dish.priceMin, detail: `${dish.priceMin}-${dish.priceMax}` },
    { label: 'dine-out price (dineOutPriceMin/Max)', ok: dish.dineOutPriceMin != null && dish.dineOutPriceMax != null && dish.dineOutPriceMax >= dish.dineOutPriceMin, detail: `${dish.dineOutPriceMin}-${dish.dineOutPriceMax}` },
    { label: 'ingredients >= 5', ok: dish.dishIngredients.length >= 5, detail: String(dish.dishIngredients.length) },
    { label: 'all ingredient quantity >= 1', ok: qtyBelowOne.length === 0, detail: qtyBelowOne.map((i: any) => `${i.rawText}=${i.quantity}`).join('; ') || 'ok' },
    { label: 'nutrition row exists', ok: !!dish.nutrition, detail: dish.nutrition ? `${dish.nutrition.calories} kcal` : 'missing' },
    { label: 'nutrition method set', ok: !!dish.nutrition?.method, detail: `${dish.nutrition?.method} (conf ${dish.nutrition?.confidence})` },
    { label: 'nutrition provenance references', ok: refs.length > 0, detail: refs.map((r) => r.provider ?? r.title).join(',') || 'none' },
    { label: 'nutrition provenance coveragePct', ok: typeof prov?.coveragePct === 'number', detail: String(prov?.coveragePct) },
    { label: 'recipe steps >= 5', ok: dish.recipeSteps.length >= 5, detail: String(dish.recipeSteps.length) },
    { label: 'steps with image >= 4', ok: stepsWithImage >= 4, detail: `${stepsWithImage}/${dish.recipeSteps.length}` },
    { label: 'videoUrl is YouTube watch URL', ok: !!dish.videoUrl && /youtube\.com\/watch\?v=|youtu\.be\//.test(dish.videoUrl), detail: dish.videoUrl ?? 'null' },
    { label: 'DishSource rows', ok: dish.sources.length > 0, detail: dish.sources.map((s: any) => `${s.sourceType}:${s.domain}(${s.reliability})`).join('; ') || 'none' },
  ];

  logger.log('─'.repeat(100));
  logger.log(`Dish ${dish.id} — "${dish.name}" (slug ${dish.slug})`);
  let failed = 0;
  for (const c of checks) {
    if (!c.ok) failed += 1;
    logger.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.label.padEnd(44)} ${c.detail ?? ''}`);
  }
  logger.log('─'.repeat(100));
  logger.log(`${checks.length - failed}/${checks.length} checks passed`);

  if (!keep) {
    await prisma.db.dish.delete({ where: { id: dish.id } });
    await (prisma.db as any).importJob.delete({ where: { id: job.id } }).catch(() => undefined);
    logger.log('Đã dọn bản nháp smoke test (dùng --keep để giữ lại)');
  } else {
    logger.log(`Giữ lại bản nháp: admin -> Kho món ăn -> ${dish.name}`);
  }

  await app.close();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
