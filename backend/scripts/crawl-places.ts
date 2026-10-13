/**
 * Admin tool: crawl restaurants (ShopeeFood / OpenStreetMap) into `places` + `place_dishes`.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/crawl-places.ts --source shopeefood --city hcm --keyword "bún bò huế" --limit 200 --dry-run
 *   npx ts-node -r tsconfig-paths/register scripts/crawl-places.ts --source osm --city hcm --radius-km 5 [--lat 10.77 --lng 106.70] [--keyword "phở"]
 *   npx ts-node -r tsconfig-paths/register scripts/crawl-places.ts --source shopeefood --city hcm --all-dishes --limit 30
 *   npx ts-node -r tsconfig-paths/register scripts/crawl-places.ts --source google --city hcm --all-dishes --limit 20 --radius-km 5
 *     (Google Places API New — cần GOOGLE_MAPS_API_KEY; --no-menu = bỏ tải ảnh để tiết kiệm quota)
 *
 * Options:
 *   --source shopeefood|osm   (default shopeefood)
 *   --city hcm|hn|dn          (default hcm)
 *   --keyword "..."           search keyword (repeatable). Without it and with --all-dishes,
 *                             every PUBLISHED dish name is used as keyword.
 *   --all-dishes              use PUBLISHED dish names as keywords
 *   --limit N                 max places per keyword (default 100)
 *   --no-menu                 ShopeeFood: skip menu fetching (faster, name-only matching)
 *   --lat/--lng/--radius-km   OSM: search center + radius (default city center, 5km)
 *   --dry-run                 do not write to DB, print match preview
 *
 * ⚠️ ShopeeFood has no public API — crawling may violate its ToS and requests can be
 * blocked (HTTP 403 without anti-bot signature headers, see shopeefood.client.ts).
 * Run manually, at ~1 req/s, keep attribution (provider + sourceUrl). Crawled places
 * are created with isVerified=false and must be reviewed in the admin Places page.
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { PrismaService } from '../src/prisma/prisma.service';
import { DishMatcherService } from '../src/places/ingest/dish-matcher.service';
import { emptyReport, PlaceIngestService, type IngestReport } from '../src/places/ingest/place-ingest.service';
import type { PlaceInput } from '../src/places/ingest/place-input';
import {
  mapShopeeFoodInfo,
  SHOPEEFOOD_CITY_IDS,
  ShopeeFoodBlockedError,
  ShopeeFoodClient,
} from '../src/places/ingest/shopeefood.client';
import { OSM_CITY_CENTERS, OsmClient } from '../src/places/ingest/osm.client';
import { GooglePlacesClient, mapGooglePlace } from '../src/places/ingest/google-places.client';
import { GeoapifyClient } from '../src/places/ingest/geoapify.client';

type Args = {
  source: 'shopeefood' | 'osm' | 'google' | 'geoapify';
  city: string;
  keywords: string[];
  allDishes: boolean;
  limit: number;
  menu: boolean;
  lat?: number;
  lng?: number;
  radiusKm: number;
  dryRun: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    source: 'shopeefood',
    city: 'hcm',
    keywords: [],
    allDishes: false,
    limit: 100,
    menu: true,
    radiusKm: 5,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--source': {
        const v = next();
        if (v !== 'shopeefood' && v !== 'osm' && v !== 'google' && v !== 'geoapify') throw new Error(`Unknown --source ${v}`);
        args.source = v;
        break;
      }
      case '--city': args.city = next(); break;
      case '--keyword': args.keywords.push(next()); break;
      case '--all-dishes': args.allDishes = true; break;
      case '--limit': args.limit = Math.max(1, Number(next()) || 100); break;
      case '--no-menu': args.menu = false; break;
      case '--lat': args.lat = Number(next()); break;
      case '--lng': args.lng = Number(next()); break;
      case '--radius-km': args.radiusKm = Math.max(0.5, Number(next()) || 5); break;
      case '--dry-run': args.dryRun = true; break;
      case '--help':
      case '-h':
        console.log('See header of scripts/crawl-places.ts for usage.');
        process.exit(0);
      default:
        throw new Error(`Unknown argument ${a}`);
    }
  }
  return args;
}

async function crawlShopeeFood(args: Args, keywords: string[]): Promise<PlaceInput[]> {
  const cityId = SHOPEEFOOD_CITY_IDS[args.city];
  if (!cityId) throw new Error(`Unsupported city for ShopeeFood: ${args.city}`);
  const client = ShopeeFoodClient.fromEnv();
  const byId = new Map<string, PlaceInput>();

  for (const keyword of keywords) {
    const ids = (await client.searchRestaurantIds(keyword, cityId)).slice(0, args.limit);
    console.log(`[shopeefood] "${keyword}": ${ids.length} restaurants`);
    const infos = await client.getInfos(ids.filter((id) => !byId.has(String(id))));
    for (const info of infos) {
      let menu: Awaited<ReturnType<ShopeeFoodClient['getMenu']>> = [];
      if (args.menu && info?.delivery_id) {
        try {
          menu = await client.getMenu(info.delivery_id);
        } catch (e) {
          if (e instanceof ShopeeFoodBlockedError) throw e;
          console.warn(`  menu failed for ${info?.name}: ${(e as Error).message}`);
        }
      }
      const place = mapShopeeFoodInfo(info, menu);
      if (place) byId.set(place.providerPlaceId, place);
    }
  }
  return [...byId.values()];
}

async function crawlGoogle(args: Args, keywords: string[]): Promise<PlaceInput[]> {
  const client = GooglePlacesClient.fromEnv();
  if (!client) throw new Error('GOOGLE_MAPS_API_KEY chưa cấu hình trong backend/.env');
  const center =
    args.lat != null && args.lng != null && Number.isFinite(args.lat) && Number.isFinite(args.lng)
      ? { lat: args.lat, lng: args.lng }
      : OSM_CITY_CENTERS[args.city];
  if (!center) throw new Error(`Unsupported city: ${args.city} (pass --lat/--lng)`);
  const byId = new Map<string, PlaceInput>();
  for (const keyword of keywords) {
    const raw = await client.searchText({
      query: keyword,
      lat: center.lat,
      lng: center.lng,
      radiusM: args.radiusKm * 1000,
      maxResults: Math.min(args.limit, 60),
    });
    console.log(`[google] "${keyword}": ${raw.length} places`);
    for (const p of raw) {
      const photo = p.photos?.[0]?.name;
      const mapped = mapGooglePlace(p, photo && args.menu ? await client.photoUrl(photo) : null);
      if (mapped) byId.set(mapped.providerPlaceId, mapped);
    }
  }
  return [...byId.values()];
}

async function crawlGeoapify(args: Args, keywords: string[]): Promise<PlaceInput[]> {
  const client = GeoapifyClient.fromEnv();
  if (!client) throw new Error('GEOAPIFY_API_KEY chưa cấu hình trong backend/.env');
  const center =
    args.lat != null && args.lng != null && Number.isFinite(args.lat) && Number.isFinite(args.lng)
      ? { lat: args.lat, lng: args.lng }
      : OSM_CITY_CENTERS[args.city];
  if (!center) throw new Error(`Unsupported city: ${args.city} (pass --lat/--lng)`);
  const byId = new Map<string, PlaceInput>();
  for (const keyword of keywords) {
    const places = await client.search({
      query: keyword,
      lat: center.lat,
      lng: center.lng,
      radiusM: args.radiusKm * 1000,
      limit: Math.min(args.limit, 100),
    });
    console.log(`[geoapify] "${keyword}": ${places.length} places`);
    for (const p of places) byId.set(p.providerPlaceId, p);
  }
  return [...byId.values()];
}

async function crawlOsm(args: Args, keywords: string[]): Promise<PlaceInput[]> {
  const center =
    args.lat != null && args.lng != null && Number.isFinite(args.lat) && Number.isFinite(args.lng)
      ? { lat: args.lat, lng: args.lng }
      : OSM_CITY_CENTERS[args.city];
  if (!center) throw new Error(`Unsupported city for OSM: ${args.city} (pass --lat/--lng)`);
  const client = new OsmClient();
  const byId = new Map<string, PlaceInput>();
  const queries = keywords.length ? keywords : [undefined];
  for (const keyword of queries) {
    const places = await client.search({
      lat: center.lat,
      lng: center.lng,
      radiusM: args.radiusKm * 1000,
      nameRegex: keyword ? keywordToRegex(keyword) : undefined,
      limit: args.limit,
    });
    console.log(`[osm] ${keyword ? `"${keyword}"` : 'all'}: ${places.length} places`);
    for (const p of places) byId.set(p.providerPlaceId, p);
  }
  return [...byId.values()];
}

/** OSM names are usually accented; match both accented & plain letters loosely. */
function keywordToRegex(keyword: string): string {
  const groups: Record<string, string> = {
    a: 'aàáảãạăằắẳẵặâầấẩẫậ', e: 'eèéẻẽẹêềếểễệ', i: 'iìíỉĩị', o: 'oòóỏõọôồốổỗộơờớởỡợ',
    u: 'uùúủũụưừứửữự', y: 'yỳýỷỹỵ', d: 'dđ',
  };
  const fold = (c: string) =>
    c.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
  return [...keyword.trim()]
    .map((c) => {
      const base = fold(c);
      if (groups[base]) return `[${groups[base]}${groups[base].toUpperCase()}]`;
      return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
}

function printReport(report: IngestReport, dryRun: boolean) {
  console.log('\n===== Crawl report =====');
  if (dryRun) {
    console.log('(dry-run: nothing written)');
    for (const p of report.dryRunPreview.slice(0, 50)) {
      const m = p.matches.map((x) => `${x.dishName} [${x.status} ${x.score}]`).join(', ') || '—';
      console.log(`  • ${p.name} (${p.provider}) -> ${m}`);
    }
    if (report.dryRunPreview.length > 50) console.log(`  … ${report.dryRunPreview.length - 50} more`);
  } else {
    console.log(`Places created:   ${report.placesCreated}`);
    console.log(`Places updated:   ${report.placesUpdated}`);
    console.log(`Places skipped:   ${report.placesSkipped} (no coords / duplicates)`);
    console.log(`Dish links:       ${report.dishLinksUpserted}`);
  }
  console.log(`Unmatched places: ${report.unmatched.length}`);
  for (const u of report.unmatched.slice(0, 30)) console.log(`  - ${u.name} (${u.provider}:${u.providerPlaceId})`);
  if (report.unmatched.length > 30) console.log(`  … ${report.unmatched.length - 30} more`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prisma = new PrismaService();
  await prisma.onModuleInit();
  try {
    const matcherService = new DishMatcherService(prisma);
    const ingest = new PlaceIngestService(prisma);
    const matcher = await matcherService.loadCatalog();

    let keywords = args.keywords;
    if (args.allDishes) {
      const dishes = await prisma.db.dish.findMany({
        where: { status: 'PUBLISHED' },
        select: { name: true },
        orderBy: { name: 'asc' },
      });
      keywords = [...new Set([...keywords, ...dishes.map((d) => d.name)])];
    }
    if (args.source !== 'osm' && keywords.length === 0) {
      throw new Error(`${args.source} needs --keyword or --all-dishes`);
    }

    const report = emptyReport();
    // Process keyword by keyword so a block midway still keeps earlier results.
    const batches = args.source === 'osm' ? [keywords] : keywords.map((k) => [k]);
    for (const batch of batches) {
      let places: PlaceInput[];
      try {
        places =
          args.source === 'shopeefood'
            ? await crawlShopeeFood(args, batch)
            : args.source === 'google'
              ? await crawlGoogle(args, batch)
              : args.source === 'geoapify'
                ? await crawlGeoapify(args, batch)
                : await crawlOsm(args, batch);
      } catch (e) {
        if (e instanceof ShopeeFoodBlockedError) {
          console.error(`\n✖ ${e.message}`);
          break;
        }
        throw e;
      }
      await ingest.ingest(places, matcher, { dryRun: args.dryRun, report });
    }
    printReport(report, args.dryRun);
  } finally {
    await prisma.onModuleDestroy();
  }
}

main().catch((e) => {
  console.error('crawl-places failed:', e);
  process.exit(1);
});
