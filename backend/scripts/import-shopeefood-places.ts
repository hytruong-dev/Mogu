/**
 * Fast Keyset-paginated Import of ShopeeFood places from source Supabase.
 * Uses `gt('id', lastId)` to avoid OFFSET statement timeouts.
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { DishMatcherService } from '../src/places/ingest/dish-matcher.service';

const SOURCE_URL = 'https://teteypzdctohbqghayye.supabase.co';
const SOURCE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRldGV5cHpkY3RvaGJxZ2hheXllIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ1NTg3MywiZXhwIjoyMDkxMDMxODczfQ.AJeehIFdDf6uIjtOiMeg3oSAGmsbf3Q5DLxAfF95kog';

function parsePriceRange(raw: string | undefined): { min: number | null; max: number | null } {
  if (!raw) return { min: null, max: null };
  const parts = raw.replace(/[^\d\s-]/g, '').trim().split(/\s*-\s*/);
  const min = parts[0] ? parseInt(parts[0], 10) : null;
  const max = parts[1] ? parseInt(parts[1], 10) : null;
  return {
    min: Number.isFinite(min) && min! > 0 ? min : null,
    max: Number.isFinite(max) && max! > 0 ? max : null,
  };
}

async function runImport() {
  const startTime = Date.now();
  console.log('=== START KEYSET SHOPEEFOOD IMPORT TO MOGU ===');

  const prisma = new PrismaService();
  await prisma.onModuleInit();

  try {
    const matcher = await new DishMatcherService(prisma).loadCatalog();
    const sourceSupabase = createClient(SOURCE_URL, SOURCE_KEY);

    const BATCH_SIZE = 1000;
    let lastId: string | null = null;
    let batchNumber = 0;
    let totalPlacesInserted = 0;
    let totalLinksInserted = 0;

    while (true) {
      batchNumber++;
      const pageStart = Date.now();

      let query = sourceSupabase
        .from('sale_posts')
        .select('id, store_name, address, lat, lng, avg_rating, photos, metadata, external_raw')
        .eq('category_slug', 'food')
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .order('id', { ascending: true })
        .limit(BATCH_SIZE);

      if (lastId) {
        query = query.gt('id', lastId);
      }

      const { data: rows, error: fetchErr } = await query;

      if (fetchErr) {
        console.error(`Error fetching batch ${batchNumber} after id=${lastId}:`, fetchErr.message);
        // Retry once after brief pause
        await new Promise((r) => setTimeout(r, 1000));
        const retry = await query;
        if (retry.error) {
          console.error(`Retry failed, stopping:`, retry.error.message);
          break;
        }
      }

      if (!rows || rows.length === 0) {
        console.log(`No more rows. Completed.`);
        break;
      }

      lastId = rows[rows.length - 1].id;

      const placesData: Prisma.PlaceCreateManyInput[] = [];
      const placeMatchMap = new Map<string, ReturnType<typeof matcher.matchPlace>>();

      for (const r of rows) {
        if (!r.store_name || r.lat == null || r.lng == null) continue;
        const jsonld = r.external_raw?.jsonld?.[1] ?? r.external_raw?.jsonld?.[0];
        const price = parsePriceRange(jsonld?.priceRange);

        placesData.push({
          provider: 'SHOPEEFOOD',
          providerPlaceId: r.id,
          name: r.store_name.slice(0, 200),
          addressShort: r.address ? r.address.slice(0, 300) : null,
          lat: new Prisma.Decimal(Number(r.lat).toFixed(7)),
          lng: new Prisma.Decimal(Number(r.lng).toFixed(7)),
          thumbnailUrl: r.photos?.[0] ?? null,
          ratingAvg: r.avg_rating ? new Prisma.Decimal(Number(r.avg_rating).toFixed(2)) : null,
          priceMin: price.min,
          priceMax: price.max,
          openingHours: r.external_raw?.opening_hours
            ? { text: r.external_raw.opening_hours }
            : undefined,
          categoryTags: ['shopeefood', 'food', r.metadata?.shopeefood_city].filter(Boolean) as string[],
          sourceUrl: r.metadata?.shopeefood_url ?? null,
          sourceMeta: {
            shopeefood_slug: r.metadata?.shopeefood_slug,
            city: r.metadata?.shopeefood_city,
            telephone: r.metadata?.telephone,
          },
          isActive: true,
          isVerified: false,
        });

        const matches = matcher.matchPlace(r.store_name);
        if (matches.length > 0) {
          placeMatchMap.set(r.id, matches);
        }
      }

      // Bulk insert places (skipping duplicates)
      const insertPlacesRes = await prisma.db.place.createMany({
        data: placesData,
        skipDuplicates: true,
      });
      totalPlacesInserted += insertPlacesRes.count;

      // Link matched dishes
      let pageLinksCount = 0;
      if (placeMatchMap.size > 0) {
        const placeIds = Array.from(placeMatchMap.keys());
        const insertedPlaces = await prisma.db.place.findMany({
          where: {
            provider: 'SHOPEEFOOD',
            providerPlaceId: { in: placeIds },
          },
          select: { id: true, providerPlaceId: true },
        });

        const linksData: Prisma.PlaceDishCreateManyInput[] = [];
        for (const p of insertedPlaces) {
          if (!p.providerPlaceId) continue;
          const matches = placeMatchMap.get(p.providerPlaceId) ?? [];
          for (const m of matches) {
            linksData.push({
              placeId: p.id,
              dishId: m.dishId,
              matchStatus: m.status,
              matchScore: new Prisma.Decimal(m.score.toFixed(3)),
              sourceItemName: m.sourceItemName ?? null,
            });
          }
        }

        if (linksData.length > 0) {
          const insertLinksRes = await prisma.db.placeDish.createMany({
            data: linksData,
            skipDuplicates: true,
          });
          pageLinksCount = insertLinksRes.count;
          totalLinksInserted += pageLinksCount;
        }
      }

      const elapsed = ((Date.now() - pageStart) / 1000).toFixed(1);
      console.log(
        `[Batch ${batchNumber}] Processed ${rows.length} rows -> +${insertPlacesRes.count} new places, +${pageLinksCount} dish links (${elapsed}s) | Total new: ${totalPlacesInserted} places, ${totalLinksInserted} links`,
      );
    }

    const durationSec = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n=== IMPORT COMPLETE in ${durationSec}s ===`);

    const finalPlaces = await prisma.db.place.count();
    const finalLinks = await prisma.db.placeDish.count();
    const byProvider = await prisma.db.place.groupBy({
      by: ['provider'],
      _count: { id: true },
    });

    console.log('Final DB Status:');
    console.log(` - Total Places: ${finalPlaces}`);
    console.log(` - Total PlaceDish Links: ${finalLinks}`);
    console.log(' - Places by Provider:', byProvider);

    // Top dishes with place links
    const topDishes = await prisma.db.dish.findMany({
      where: { placeDishes: { some: {} } },
      select: {
        name: true,
        _count: { select: { placeDishes: true } },
      },
      orderBy: {
        placeDishes: { _count: 'desc' },
      },
      take: 20,
    });

    console.log('\nTop dishes with places in DB:');
    for (const d of topDishes) {
      console.log(` • ${d.name}: ${d._count.placeDishes} quán`);
    }
  } finally {
    await prisma.onModuleDestroy();
  }
}

runImport().catch(console.error);
