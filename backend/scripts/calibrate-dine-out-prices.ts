/**
 * So sánh dine_out_price_min / dine_out_price_max của món ăn trong DB với giá quán ShopeeFood thực tế (p25/p75).
 * Mặc định chạy ở chế độ DRY-RUN (chỉ in bảng đối chiếu, không ghi DB).
 *
 * Chạy xem:
 *   npx ts-node -r tsconfig-paths/register scripts/calibrate-dine-out-prices.ts
 *
 * Áp dụng cập nhật vào DB:
 *   npx ts-node -r tsconfig-paths/register scripts/calibrate-dine-out-prices.ts --apply
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { PrismaService } from '../src/prisma/prisma.service';

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  const weight = idx - lower;
  return Math.round(sorted[lower] * (1 - weight) + sorted[upper] * weight);
}

function formatVnd(v: number | null | undefined): string {
  if (v == null) return '-';
  return `${Math.round(v / 1000)}k`;
}

async function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const dryRun = !apply;
  const minPlaces = 10;

  console.log(`\n=== CALIBRATE DINE-OUT PRICES (${dryRun ? 'DRY-RUN' : 'APPLYING TO DB'}) ===`);
  console.log(`Lấy các món có >= ${minPlaces} quán ShopeeFood có giá để đối chiếu...\n`);

  const prisma = new PrismaService();
  await prisma.onModuleInit();

  try {
    const dishes = await prisma.db.dish.findMany({
      where: { publishedAt: { not: null } },
      select: {
        id: true,
        name: true,
        dineOutPriceMin: true,
        dineOutPriceMax: true,
        priceMin: true,
        priceMax: true,
        placeDishes: {
          where: {
            place: {
              provider: 'SHOPEEFOOD',
              isActive: true,
              OR: [{ priceMin: { gt: 0 } }, { priceMax: { gt: 0 } }],
            },
          },
          select: {
            priceVnd: true,
            place: {
              select: {
                priceMin: true,
                priceMax: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const rows: Array<{
      id: string;
      name: string;
      currentDineOut: string;
      shopeeP25P75: string;
      p25Min: number;
      p75Max: number;
      sampleCount: number;
      cookPrice: string;
    }> = [];

    for (const d of dishes) {
      const mins: number[] = [];
      const maxs: number[] = [];

      for (const pd of d.placeDishes) {
        const pMin = pd.priceVnd && pd.priceVnd > 0
          ? pd.priceVnd
          : pd.place.priceMin && pd.place.priceMin > 0
            ? pd.place.priceMin
            : null;
        const pMax = pd.priceVnd && pd.priceVnd > 0
          ? pd.priceVnd
          : pd.place.priceMax && pd.place.priceMax > 0
            ? pd.place.priceMax
            : null;

        if (pMin != null) mins.push(pMin);
        if (pMax != null) maxs.push(pMax);
      }

      if (mins.length < minPlaces && maxs.length < minPlaces) {
        continue;
      }

      mins.sort((a, b) => a - b);
      maxs.sort((a, b) => a - b);

      let p25Min = mins.length > 0 ? percentile(mins, 0.25) : percentile(maxs, 0.25);
      let p75Max = maxs.length > 0 ? percentile(maxs, 0.75) : percentile(mins, 0.75);

      if (p75Max < p25Min) p75Max = p25Min;

      // Làm tròn 1000đ
      p25Min = Math.round(p25Min / 1000) * 1000;
      p75Max = Math.round(p75Max / 1000) * 1000;

      rows.push({
        id: d.id,
        name: d.name,
        currentDineOut: `${formatVnd(d.dineOutPriceMin)}–${formatVnd(d.dineOutPriceMax)}`,
        shopeeP25P75: `${formatVnd(p25Min)}–${formatVnd(p75Max)}`,
        p25Min,
        p75Max,
        sampleCount: Math.max(mins.length, maxs.length),
        cookPrice: `${formatVnd(d.priceMin)}–${formatVnd(d.priceMax)} (nấu)`,
      });
    }

    console.table(
      rows.map((r) => ({
        'Tên món': r.name,
        'Dine-out hiện tại': r.currentDineOut,
        'ShopeeFood p25-p75': r.shopeeP25P75,
        'Số quán mẫu': r.sampleCount,
        'Giá nấu (batch)': r.cookPrice,
      })),
    );

    console.log(`\nTổng số món đủ mẫu (>= ${minPlaces} quán): ${rows.length}/${dishes.length}`);

    if (apply) {
      console.log('\nĐang cập nhật dine_out_price vào DB...');
      for (const r of rows) {
        await prisma.db.dish.update({
          where: { id: r.id },
          data: {
            dineOutPriceMin: r.p25Min,
            dineOutPriceMax: r.p75Max,
          },
        });
      }
      console.log(`Đã cập nhật thành công ${rows.length} món ăn.`);
    } else {
      console.log('\n(DRY-RUN kết thúc. Để áp dụng giá mới vào DB, chạy với cờ `--apply`.)');
    }
  } finally {
    await prisma.onModuleDestroy();
  }
}

main().catch((err) => {
  console.error('Calibration error:', err);
  process.exit(1);
});
