/**
 * reupload-webp.ts
 *
 * Chiến lược:
 * 1. Với ingredients ĐÃ có imageUrl → download → convert WebP → upload lại
 * 2. Với ingredients CHƯA có imageUrl → search (Wikipedia VI → EN → Unsplash) → convert WebP → upload
 * 3. Tất cả ảnh đều được upload lên bucket "ingredient-images" dạng .webp
 * 4. Cập nhật imageUrl + imageKey trong DB
 */
import * as https from 'https';
import * as http from 'http';
import { URL as NodeURL } from 'url';
import * as path from 'path';
import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const pool = new (pg.Pool)({
  connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter } as any) as any;

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY!;
const BUCKET = 'ingredient-images';
const SUPABASE_URL = process.env.SUPABASE_URL!;

// ─── HTTP helper ──────────────────────────────────────────────────────────────
function httpGet(url: string, timeout = 20000): Promise<{ status: number; data: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new NodeURL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.get(url, {
        headers: {
          'User-Agent': 'MoguBot/2.0 (ingredient-images-webp)',
          Accept: 'image/webp,image/avif,image/*,*/*',
        },
        timeout,
      }, (res) => {
        if ([301, 302, 307, 308].includes(res.statusCode ?? 0) && res.headers.location) {
          return httpGet(res.headers.location!, timeout).then(resolve).catch(reject);
        }
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve({
          status: res.statusCode ?? 0,
          data: Buffer.concat(chunks),
          contentType: (res.headers['content-type'] ?? 'image/jpeg').split(';')[0].trim(),
        }));
        res.on('error', reject);
      });
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      req.on('error', reject);
    } catch (e) { reject(e); }
  });
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── Convert to WebP ─────────────────────────────────────────────────────────
async function toWebP(inputBuffer: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(inputBuffer)
      .webp({ quality: 82, effort: 4 })
      .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
      .toBuffer();
  } catch (e: any) {
    return null;
  }
}

// ─── Upload WebP to Supabase ──────────────────────────────────────────────────
async function uploadWebP(webpBuffer: Buffer, code: string): Promise<{ url: string; key: string } | null> {
  try {
    const key = `${code.toLowerCase().replace(/[^a-z0-9-]/g, '-')}.webp`;
    const { error } = await supabase.storage.from(BUCKET).upload(key, webpBuffer, {
      contentType: 'image/webp',
      upsert: true,
    });
    if (error) { console.error(`    ⚠ Upload error: ${error.message}`); return null; }
    return {
      url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${key}`,
      key,
    };
  } catch (e: any) {
    console.error(`    ⚠ Upload exception: ${e.message}`);
    return null;
  }
}

// ─── Image search (for items without image) ───────────────────────────────────
const VI_EN: Record<string, string> = {
  'rau muống': 'water spinach', 'rau cải xanh': 'bok choy', 'cải ngọt': 'bok choy',
  'cải bẹ trắng': 'napa cabbage', 'cải thìa': 'pak choi', 'cải xoong': 'watercress',
  'cải bó xôi': 'spinach', 'cải kale': 'kale', 'cải xoăn': 'curly kale',
  'cải cúc': 'chrysanthemum greens', 'tần ô': 'chrysanthemum greens',
  'bắp cải xanh': 'green cabbage', 'bắp cải tím': 'red cabbage',
  'xà lách xoăn': 'frisee lettuce', 'xà lách mỡ': 'butter lettuce',
  'xà lách iceberg': 'iceberg lettuce', 'xà lách romaine': 'romaine lettuce',
  'rau mầm': 'microgreens', 'rau dền đỏ': 'red amaranth', 'rau dền xanh': 'amaranth',
  'rau đay': 'jute leaves', 'rau mồng tơi': 'malabar spinach',
  'rau ngót': 'sauropus leaves', 'rau má': 'gotu kola', 'rau sam': 'purslane',
  'rau lang': 'sweet potato leaves', 'rau tía tô': 'perilla leaf',
  'rau kinh giới': 'vietnamese balm herb', 'rau húng quế': 'Thai basil',
  'rau húng lủi': 'spearmint', 'rau húng cây': 'peppermint',
  'rau răm': 'Vietnamese coriander', 'rau ngổ': 'rice paddy herb',
  'rau mùi': 'cilantro', 'ngò rí': 'cilantro', 'ngò gai': 'sawtooth herb',
  'hành lá': 'scallion green onion', 'hành boa rô': 'leek',
  'lá lốt': 'betel leaf lolot', 'lá giang': 'aganonerion leaf',
  'lá chanh': 'kaffir lime leaf', 'lá cà ri': 'curry leaf',
  'lá dứa': 'pandan leaf', 'lá nếp': 'pandan leaf',
  'lá nguyệt quế': 'bay leaf', 'hẹ': 'garlic chives',
  'thì là': 'dill herb', 'cần tây': 'celery', 'bạc hà': 'mint leaves',
  'diếp cá': 'houttuynia fish mint', 'bông cải xanh': 'broccoli',
  'bông cải trắng': 'cauliflower', 'bắp non': 'baby corn',
  'bắp chuối': 'banana blossom', 'bông bí': 'pumpkin flower',
  'bông điên điển': 'sesbania flower', 'bông súng': 'water lily flower',
  'bông hẹ': 'garlic chive flower', 'hoa chuối': 'banana flower blossom',
  'giá đỗ': 'bean sprouts', 'măng tây': 'asparagus', 'măng tre': 'bamboo shoots',
  'khoai lang': 'sweet potato', 'khoai tây': 'potato', 'khoai môn': 'taro root',
  'khoai mì': 'cassava', 'cà rốt': 'carrot', 'củ cải trắng': 'daikon radish',
  'củ dền': 'beetroot', 'hành tây': 'onion', 'hành tím': 'shallot',
  'tỏi': 'garlic', 'gừng': 'ginger', 'nghệ': 'turmeric', 'sả': 'lemongrass',
  'riềng': 'galangal', 'ngô': 'corn', 'bí đỏ': 'pumpkin', 'bí xanh': 'winter melon',
  'bí ngòi': 'zucchini', 'mướp': 'luffa', 'mướp đắng': 'bitter melon',
  'khổ qua': 'bitter melon', 'su su': 'chayote', 'cà chua': 'tomato',
  'cà tím': 'eggplant', 'ớt chuông': 'bell pepper', 'đậu que': 'green beans',
  'đậu bắp': 'okra', 'nấm rơm': 'straw mushroom', 'nấm đông cô': 'shiitake mushroom',
  'nấm kim châm': 'enoki mushroom', 'nấm mèo': 'wood ear mushroom',
  'nấm bào ngư': 'oyster mushroom', 'nấm linh chi': 'reishi mushroom',
  'chuối': 'banana', 'xoài': 'mango', 'ổi': 'guava', 'đu đủ': 'papaya',
  'dứa': 'pineapple', 'thanh long': 'dragon fruit', 'chôm chôm': 'rambutan',
  'nhãn': 'longan', 'vải': 'lychee', 'mít': 'jackfruit', 'sầu riêng': 'durian',
  'bơ': 'avocado', 'dâu tây': 'strawberry', 'nho': 'grapes', 'táo': 'apple',
  'lê': 'pear', 'cam': 'orange', 'quýt': 'tangerine', 'bưởi': 'pomelo',
  'chanh': 'lemon', 'chanh dây': 'passion fruit', 'khế': 'starfruit',
  'me': 'tamarind', 'mận': 'plum', 'vú sữa': 'star apple', 'mãng cầu': 'custard apple',
  'thịt heo': 'pork', 'thịt bò': 'beef', 'thịt gà': 'chicken', 'thịt vịt': 'duck',
  'sườn heo': 'pork ribs', 'ba chỉ': 'pork belly', 'chân giò': 'pork knuckle',
  'đùi gà': 'chicken thigh', 'ức gà': 'chicken breast', 'cánh gà': 'chicken wing',
  'gan heo': 'pork liver', 'trứng gà': 'chicken egg', 'trứng vịt': 'duck egg',
  'trứng cút': 'quail egg', 'cá trắm': 'grass carp', 'cá chép': 'carp',
  'cá lóc': 'snakehead fish', 'cá ngừ': 'tuna', 'cá thu': 'mackerel', 'cá hồi': 'salmon',
  'tôm': 'shrimp', 'tôm sú': 'tiger prawn', 'cua': 'crab', 'ghẹ': 'blue crab',
  'mực': 'squid', 'bạch tuộc': 'octopus', 'hàu': 'oyster', 'nghêu': 'clam',
  'gạo tẻ': 'white rice', 'gạo nếp': 'sticky rice', 'bột mì': 'wheat flour',
  'bột gạo': 'rice flour', 'bột năng': 'tapioca starch', 'mì': 'noodle',
  'bún': 'rice vermicelli', 'miến': 'glass noodle', 'đậu xanh': 'mung bean',
  'đậu đen': 'black bean', 'đậu đỏ': 'red bean', 'đậu nành': 'soybean',
  'đậu phộng': 'peanut', 'hạt sen': 'lotus seed', 'muối': 'salt', 'đường': 'sugar',
  'nước mắm': 'fish sauce', 'xì dầu': 'soy sauce', 'dầu hào': 'oyster sauce',
  'giấm': 'vinegar', 'tiêu': 'black pepper', 'hồi': 'star anise', 'quế': 'cinnamon',
  'đinh hương': 'clove', 'thảo quả': 'black cardamom', 'ớt': 'chili pepper',
  'mè': 'sesame seeds', 'vừng': 'sesame', 'dầu ăn': 'cooking oil',
  'dầu mè': 'sesame oil', 'dầu dừa': 'coconut oil', 'dầu olive': 'olive oil',
  'tương ớt': 'chili sauce', 'sữa dừa': 'coconut milk',
  'mắm tôm': 'shrimp paste', 'đậu hũ': 'tofu', 'yến mạch': 'oat',
  'hạt điều': 'cashew', 'hạt óc chó': 'walnut', 'hạnh nhân': 'almond',
};

function toEn(name: string): string {
  const lower = name.toLowerCase().trim();
  if (VI_EN[lower]) return VI_EN[lower];
  for (const [vi, en] of Object.entries(VI_EN)) {
    if (lower.includes(vi)) return en;
    if (vi.includes(lower) && lower.length > 4) return en;
  }
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd');
}

async function searchWikipedia(name: string, lang: 'vi' | 'en'): Promise<string | null> {
  try {
    const q = lang === 'vi' ? name : toEn(name);
    const searchRes = await httpGet(
      `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=3&format=json&origin=*`,
      8000,
    );
    if (searchRes.status !== 200) return null;
    const hits = JSON.parse(searchRes.data.toString('utf-8'))?.query?.search ?? [];
    for (const hit of hits.slice(0, 2)) {
      const imgRes = await httpGet(
        `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(hit.title)}&prop=pageimages&pithumbsize=600&format=json&origin=*`,
        8000,
      );
      if (imgRes.status !== 200) continue;
      const pages = JSON.parse(imgRes.data.toString('utf-8'))?.query?.pages ?? {};
      for (const page of Object.values(pages) as any[]) {
        if (page.thumbnail?.source) return page.thumbnail.source;
      }
    }
  } catch { /* ignore */ }
  return null;
}

let unsplashUsed = 0;
const UNSPLASH_LIMIT = 45;

async function searchUnsplash(name: string): Promise<string | null> {
  if (!UNSPLASH_KEY || unsplashUsed >= UNSPLASH_LIMIT) return null;
  try {
    const q = encodeURIComponent(toEn(name) + ' ingredient food');
    const res = await httpGet(
      `https://api.unsplash.com/search/photos?query=${q}&per_page=5&orientation=squarish&client_id=${UNSPLASH_KEY}`,
      8000,
    );
    if (res.status === 429 || res.status === 403) {
      unsplashUsed = UNSPLASH_LIMIT; // mark as exhausted
      return null;
    }
    if (res.status !== 200) return null;
    unsplashUsed++;
    const results = JSON.parse(res.data.toString('utf-8'))?.results ?? [];
    if (!results.length) return null;
    const en = toEn(name).toLowerCase().split(' ');
    let best = results[0]; let bestScore = -1;
    for (const r of results) {
      const desc = ((r.alt_description ?? '') + ' ' + (r.description ?? '')).toLowerCase();
      const score = en.filter(k => k.length > 3 && desc.includes(k)).length;
      if (score > bestScore) { bestScore = score; best = r; }
    }
    return best.urls?.regular ?? null;
  } catch { return null; }
}

async function findImageUrl(name: string): Promise<string | null> {
  const wVI = await searchWikipedia(name, 'vi');
  if (wVI) return wVI;
  const wEN = await searchWikipedia(name, 'en');
  if (wEN) return wEN;
  const usp = await searchUnsplash(name);
  if (usp) return usp;
  return null;
}

// ─── Ensure bucket ───────────────────────────────────────────────────────────
async function ensureBucket() {
  const { data } = await supabase.storage.listBuckets();
  if (!data?.some(b => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, { public: true });
  }
}

// ─── Process one ingredient ──────────────────────────────────────────────────
async function processIngredient(item: {
  id: string; name: string; code: string; imageUrl: string | null;
}): Promise<'converted' | 'new' | 'skipped' | 'failed'> {
  let rawBuffer: Buffer | null = null;
  let source = '';

  if (item.imageUrl) {
    // ── Case 1: Already has image → re-download and convert to WebP
    // Skip if already a webp in our bucket
    if (item.imageUrl.includes(SUPABASE_URL) && item.imageUrl.endsWith('.webp')) {
      return 'skipped'; // already WebP in Supabase
    }
    try {
      const res = await httpGet(item.imageUrl, 15000);
      if (res.status === 200 && res.data.length > 1000) {
        rawBuffer = res.data;
        source = 'existing';
      }
    } catch { /* fall through to search */ }
  }

  if (!rawBuffer) {
    // ── Case 2: No image or download failed → search for new one
    const imgUrl = await findImageUrl(item.name);
    if (!imgUrl) return 'failed';
    try {
      const res = await httpGet(imgUrl, 15000);
      if (res.status === 200 && res.data.length > 1000) {
        rawBuffer = res.data;
        source = 'search';
      }
    } catch { return 'failed'; }
  }

  if (!rawBuffer) return 'failed';

  // ── Convert to WebP
  const webpBuffer = await toWebP(rawBuffer);
  if (!webpBuffer || webpBuffer.length < 100) return 'failed';

  // ── Upload
  const up = await uploadWebP(webpBuffer, item.code);
  if (!up) return 'failed';

  // ── Update DB
  await db.ingredient.update({
    where: { id: item.id },
    data: { imageUrl: up.url, imageKey: up.key },
  });

  return source === 'existing' ? 'converted' : 'new';
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Bắt đầu reupload-webp.ts\n');
  await ensureBucket();

  // Load ALL ingredients (cả có và chưa có ảnh)
  const items = await db.ingredient.findMany({
    select: { id: true, name: true, code: true, imageUrl: true },
    orderBy: { code: 'asc' },
  });

  console.log(`📋 Tổng ingredients: ${items.length}`);
  const hasImg = items.filter((i: any) => i.imageUrl).length;
  const noImg = items.length - hasImg;
  console.log(`   Đã có ảnh: ${hasImg} | Chưa có: ${noImg}`);
  console.log(`   Unsplash quota: ${UNSPLASH_LIMIT} requests\n`);

  let converted = 0, newImg = 0, skipped = 0, failed = 0;
  const startTime = Date.now();
  const BATCH = 5; // process 5 in parallel

  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    const results = await Promise.all(batch.map((item: any) => processIngredient(item)));

    for (let j = 0; j < batch.length; j++) {
      const item = batch[j];
      const result = results[j];
      const prog = `[${(i + j + 1).toString().padStart(4)}/${items.length}]`;

      if (result === 'converted') { converted++; console.log(`${prog} ♻️  ${item.name} → WebP`); }
      else if (result === 'new') { newImg++; console.log(`${prog} ✅ ${item.name} → new WebP`); }
      else if (result === 'skipped') { skipped++; /* silent */ }
      else { failed++; if (item.imageUrl || !item.imageUrl) process.stdout.write(`${prog} ✗ ${item.name}\n`); }
    }

    // Rate limiting
    await sleep(500);

    if ((i + BATCH) % 100 === 0) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const withImg = await db.ingredient.count({ where: { imageUrl: { not: null } } });
      console.log(`\n  📊 [${i + BATCH}/${items.length}] converted=${converted} new=${newImg} failed=${failed} dbImg=${withImg} | ${elapsed}s | Unsplash used=${unsplashUsed}\n`);
    }
  }

  // Final stats
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const withImg = await db.ingredient.count({ where: { imageUrl: { not: null } } });
  const total = await db.ingredient.count();

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`♻️  Converted (có sẵn → WebP)  : ${converted}`);
  console.log(`✅ Tìm mới + WebP               : ${newImg}`);
  console.log(`⏭️  Đã là WebP (bỏ qua)         : ${skipped}`);
  console.log(`✗  Thất bại                     : ${failed}`);
  console.log(`📊 Có ảnh trong DB               : ${withImg}/${total}`);
  console.log(`⏱️  Thời gian                     : ${elapsed}s`);
}

main().catch(console.error).finally(async () => {
  await db.$disconnect();
  await pool.end();
});
