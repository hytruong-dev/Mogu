/**
 * Chạy lại pipeline tìm ảnh nguyên liệu (entity-first) cho các nguyên liệu chưa có ảnh.
 *
 *   npx ts-node -r tsconfig-paths/register scripts/reenrich-ingredient-images.ts            # tất cả nguyên liệu chưa có ảnh
 *   npx ts-node -r tsconfig-paths/register scripts/reenrich-ingredient-images.ts --all      # kể cả nguyên liệu đã có ảnh
 *   npx ts-node -r tsconfig-paths/register scripts/reenrich-ingredient-images.ts "thịt bò" "muối"
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { IngredientsModule } from '../src/ingredients/ingredients.module';
import { IngredientImageEnrichmentService } from '../src/ingredients/ingredient-image/ingredient-image-enrichment.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../src/prisma/prisma.module';
import appConfig from '../src/config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    IngredientsModule,
  ],
})
class ScriptModule {}

async function main() {
  const args = process.argv.slice(2);
  const includeAll = args.includes('--all');
  const names = args.filter((a) => !a.startsWith('--'));

  const app = await NestFactory.createApplicationContext(ScriptModule, {
    logger: ['log', 'warn', 'error'],
  });
  const logger = new Logger('ReenrichScript');
  const prisma = app.get(PrismaService);
  const enrichment = app.get(IngredientImageEnrichmentService);

  const where: any = names.length
    ? { name: { in: names, mode: 'insensitive' } }
    : includeAll
      ? {}
      : { imageUrl: null };

  const ingredients = await prisma.db.ingredient.findMany({
    where,
    select: { id: true, name: true, imageStatus: true },
    orderBy: { createdAt: 'desc' },
  });

  logger.log(`Found ${ingredients.length} ingredient(s) to process`);

  let ok = 0;
  let notFound = 0;
  let failed = 0;
  const start = Date.now();

  for (const [i, ing] of ingredients.entries()) {
    const t0 = Date.now();
    try {
      await enrichment.enrichIngredient(ing.id);
      const after = await prisma.db.ingredient.findUnique({
        where: { id: ing.id },
        select: { imageUrl: true, imageStatus: true, nameEn: true },
      });
      const hasImg = Boolean(after?.imageUrl);
      if (hasImg) ok += 1;
      else if (after?.imageStatus === 'NOT_FOUND') notFound += 1;
      else failed += 1;
      logger.log(
        `[${i + 1}/${ingredients.length}] ${ing.name} (${after?.nameEn ?? '-'}) -> ${after?.imageStatus} image=${hasImg ? 'YES' : 'no'} (${Date.now() - t0}ms)`,
      );
    } catch (err) {
      failed += 1;
      logger.error(`[${i + 1}/${ingredients.length}] ${ing.name} FAILED: ${(err as Error).message}`);
    }
  }

  logger.log(
    `Done in ${Math.round((Date.now() - start) / 1000)}s: with image=${ok}, not found=${notFound}, failed/pending=${failed} / ${ingredients.length}`,
  );

  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
