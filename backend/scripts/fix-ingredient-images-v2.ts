/**
 * fix-ingredient-images-v2.ts
 * Tìm ảnh cho các nguyên liệu chưa có ảnh:
 * 1. Wikimedia Commons (keyless, có nhiều ảnh thực phẩm)
 * 2. Wikipedia VI (pageimages)
 * 3. Wikipedia EN (pageimages)
 * 4. Unsplash (có key, nhưng rate-limited — dùng tiết kiệm)
 * Upload lên Supabase Storage bucket "ingredient-images"
 */
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import * as path from 'path';
import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

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

// ─── HTTP helper ─────────────────────────────────────────────────────────────
function httpGet(url: string, timeout = 15000): Promise<{ status: number; data: Buffer; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(url, {
      headers: { 'User-Agent': 'MoguBot/1.0 (ingredient-images)', Accept: 'application/json, image/*, */*' },
      timeout,
    }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode ?? 0) && res.headers.location) {
        return httpGet(res.headers.location!, timeout).then(resolve).catch(reject);
      }
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, data: Buffer.concat(chunks), headers: res.headers as any }));
      res.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── VI → EN mapping (comprehensive) ─────────────────────────────────────────
const VI_EN: Record<string, string> = {
  // Rau lá & thơm
  'rau muống': 'water spinach', 'rau cải xanh': 'bok choy', 'cải ngọt': 'bok choy sweet',
  'cải bẹ trắng': 'napa cabbage', 'cải thìa': 'pak choi', 'cải xoong': 'watercress',
  'cải bó xôi': 'spinach', 'cải kale': 'kale', 'cải xoăn': 'curly kale',
  'cải cúc': 'chrysanthemum greens', 'tần ô': 'chrysanthemum greens',
  'cải bẹ dún': 'savoy cabbage', 'cải làn': 'gai lan', 'cải chíp': 'baby bok choy',
  'bắp cải xanh': 'green cabbage', 'bắp cải tím': 'red cabbage',
  'xà lách xoăn': 'frisee lettuce', 'xà lách mỡ': 'butter lettuce',
  'xà lách iceberg': 'iceberg lettuce', 'xà lách romaine': 'romaine lettuce',
  'rau mầm': 'microgreens sprouts', 'rau dền đỏ': 'red amaranth leaves',
  'rau dền xanh': 'green amaranth', 'rau đay': 'jute leaves',
  'rau mồng tơi': 'malabar spinach', 'rau ngót': 'sauropus androgynous',
  'rau má': 'gotu kola centella', 'rau sam': 'purslane herb',
  'rau lang': 'sweet potato leaves', 'rau nhút': 'sensitive plant water mimosa',
  'rau rút': 'water mimosa', 'rau càng cua': 'peperomia herb',
  'rau tần ô': 'chrysanthemum greens', 'rau bina': 'spinach',
  'rau tía tô': 'perilla frutescens', 'rau kinh giới': 'elsholtzia herb',
  'rau húng quế': 'Thai basil', 'rau húng lủi': 'spearmint', 'rau húng cây': 'mint herb',
  'rau răm': 'Vietnamese coriander', 'rau ngổ': 'rice paddy herb limnophila',
  'rau om': 'rice paddy herb', 'rau mùi': 'cilantro coriander',
  'ngò rí': 'cilantro leaves', 'ngò gai': 'sawtooth herb eryngium',
  'ngò ôm': 'rice paddy herb',
  'hành lá': 'green onion scallion', 'hành boa rô': 'leek',
  'lá lốt': 'piper sarmentosum leaf', 'lá giang': 'aganonerion polymorphum leaf',
  'lá chanh': 'kaffir lime leaf', 'lá cà ri': 'curry leaf',
  'lá chuối': 'banana leaf', 'lá dứa': 'pandan leaf', 'lá nếp': 'pandan leaf',
  'lá nguyệt quế': 'bay leaf', 'lá hẹ': 'garlic chive leaf', 'hẹ': 'garlic chives',
  'thì là': 'dill herb', 'cần tây': 'celery', 'cần nước': 'water celery',
  'bạc hà': 'mint spearmint', 'diếp cá': 'fish mint houttuynia',
  'bông cải xanh': 'broccoli', 'bông cải trắng': 'cauliflower',
  'bắp non': 'baby corn', 'bắp chuối': 'banana blossom',
  'bông bí': 'zucchini flower', 'bông điên điển': 'sesbania flower',
  'bông so đũa': 'agati flower', 'bông súng': 'water lily flower',
  'bông thiên lý': 'telosma cordata flower', 'bông hẹ': 'garlic chive flower',
  'hoa chuối': 'banana blossom flower', 'hoa hiên': 'daylily flower',
  'giá đỗ': 'bean sprouts', 'giá hẹ': 'garlic chive sprouts',
  'mầm đậu nành': 'soybean sprouts', 'mầm cải': 'radish sprouts',
  'măng tây': 'asparagus', 'măng tre': 'bamboo shoots',
  'măng nứa': 'bamboo shoots', 'măng le': 'bamboo shoots',
  'măng chua': 'fermented bamboo shoots', 'măng khô': 'dried bamboo shoots',
  // Củ quả nấm
  'khoai lang': 'sweet potato', 'khoai tây': 'potato', 'khoai môn': 'taro',
  'khoai sọ': 'taro corm', 'khoai mì': 'cassava', 'khoai từ': 'yam',
  'cà rốt': 'carrot', 'củ cải trắng': 'daikon radish', 'củ cải đỏ': 'red radish',
  'củ dền': 'beetroot', 'hành củ': 'onion', 'hành tây': 'onion',
  'hành tím': 'shallot', 'tỏi': 'garlic', 'gừng': 'ginger root',
  'nghệ': 'turmeric root', 'sả': 'lemongrass', 'riềng': 'galangal root',
  'ngô': 'corn cob', 'bắp': 'corn', 'bí đỏ': 'pumpkin', 'bí xanh': 'winter melon',
  'bí ngòi': 'zucchini', 'mướp': 'luffa', 'mướp đắng': 'bitter melon',
  'khổ qua': 'bitter melon', 'su su': 'chayote', 'cà chua': 'tomato',
  'cà tím': 'eggplant', 'ớt chuông': 'bell pepper',
  'đậu que': 'green beans', 'đậu đũa': 'yard long beans',
  'đậu Hà Lan': 'snow peas', 'đậu bắp': 'okra lady finger',
  'nấm rơm': 'straw mushroom', 'nấm đông cô': 'shiitake mushroom',
  'nấm kim châm': 'enoki mushroom', 'nấm mèo': 'wood ear mushroom',
  'nấm hương': 'shiitake mushroom dried', 'nấm bào ngư': 'oyster mushroom',
  'nấm linh chi': 'reishi mushroom', 'nấm truffle': 'truffle mushroom',
  // Trái cây
  'chuối': 'banana', 'xoài': 'mango', 'ổi': 'guava', 'đu đủ': 'papaya',
  'dứa': 'pineapple', 'thơm': 'pineapple', 'thanh long': 'dragon fruit',
  'chôm chôm': 'rambutan', 'nhãn': 'longan', 'vải': 'lychee',
  'mít': 'jackfruit', 'sầu riêng': 'durian', 'bơ': 'avocado',
  'dâu tây': 'strawberry', 'nho': 'grapes', 'táo': 'apple',
  'lê': 'pear', 'cam': 'orange', 'quýt': 'tangerine mandarin',
  'bưởi': 'pomelo', 'chanh': 'lemon lime', 'chanh dây': 'passion fruit',
  'khế': 'starfruit carambola', 'me': 'tamarind', 'me chua': 'tamarind',
  'mận': 'plum', 'đào': 'peach', 'mơ': 'apricot', 'cherry': 'cherry',
  'vú sữa': 'star apple caimito', 'mãng cầu': 'custard apple soursop',
  'na': 'custard apple', 'sabô': 'sapodilla', 'chùm ruột': 'Phyllanthus acidus',
  // Thịt trứng
  'thịt heo': 'pork meat', 'thịt bò': 'beef', 'thịt gà': 'chicken',
  'thịt vịt': 'duck meat', 'thịt dê': 'goat meat', 'thịt cừu': 'lamb',
  'thịt thỏ': 'rabbit meat', 'thịt trâu': 'buffalo meat',
  'sườn heo': 'pork ribs', 'ba chỉ': 'pork belly', 'nạc vai': 'pork shoulder',
  'chân giò': 'pork knuckle', 'giò heo': 'pork hock',
  'đùi gà': 'chicken thigh', 'ức gà': 'chicken breast', 'cánh gà': 'chicken wing',
  'lòng heo': 'pork intestine', 'gan heo': 'pork liver', 'tim heo': 'pork heart',
  'trứng gà': 'chicken egg', 'trứng vịt': 'duck egg', 'trứng cút': 'quail egg',
  'pate gan': 'pate liver',
  // Cá hải sản
  'cá trắm': 'grass carp', 'cá chép': 'common carp', 'cá rô': 'snakehead fish',
  'cá lóc': 'snakehead fish', 'cá basa': 'basa fish', 'cá tra': 'pangasius',
  'cá ngừ': 'tuna fish', 'cá thu': 'mackerel fish', 'cá hồi': 'salmon',
  'cá ngần': 'anchovy', 'cá cơm': 'anchovy', 'cá kèo': 'mudskipper fish',
  'tôm': 'shrimp', 'tôm sú': 'tiger prawn', 'tôm he': 'white shrimp',
  'tôm càng': 'freshwater prawn', 'cua': 'crab', 'ghẹ': 'blue crab',
  'mực': 'squid', 'bạch tuộc': 'octopus', 'sò': 'clam',
  'hàu': 'oyster', 'nghêu': 'clam bivalve', 'ốc': 'snail',
  'cá khô': 'dried fish', 'tôm khô': 'dried shrimp',
  'mực khô': 'dried squid', 'cua đồng': 'field crab',
  // Gạo bột
  'gạo tẻ': 'white rice', 'gạo nếp': 'glutinous rice sticky rice',
  'bột mì': 'wheat flour', 'bột gạo': 'rice flour',
  'bột nếp': 'glutinous rice flour', 'bột bắp': 'corn starch',
  'bột năng': 'tapioca starch', 'tinh bột năng': 'tapioca starch',
  'mì': 'noodle pasta', 'phở': 'pho rice noodle', 'bún': 'rice vermicelli',
  'miến': 'glass noodle', 'hủ tiếu': 'rice noodle',
  'đậu xanh': 'mung bean', 'đậu đen': 'black bean',
  'đậu đỏ': 'red kidney bean', 'đậu nành': 'soybean',
  'đậu phộng': 'peanut groundnut', 'hạt sen': 'lotus seed',
  // Gia vị
  'muối': 'salt', 'đường': 'sugar', 'nước mắm': 'fish sauce',
  'tương': 'soybean paste', 'xì dầu': 'soy sauce', 'dầu hào': 'oyster sauce',
  'giấm': 'vinegar', 'tiêu': 'black pepper', 'hồi': 'star anise',
  'quế': 'cinnamon stick', 'đinh hương': 'clove spice',
  'thảo quả': 'black cardamom', 'sa tế': 'sambal sauce',
  'bột ngọt': 'monosodium glutamate MSG', 'hạt nêm': 'seasoning powder',
  'ớt': 'chili pepper', 'ớt đỏ': 'red chili', 'ớt xanh': 'green chili',
  'mè': 'sesame seeds', 'vừng': 'sesame seeds', 'hạt tiêu': 'peppercorns',
  'nghệ bột': 'turmeric powder', 'gừng bột': 'ginger powder',
  // Dầu sốt
  'dầu ăn': 'cooking oil vegetable oil', 'dầu mè': 'sesame oil',
  'dầu dừa': 'coconut oil', 'dầu olive': 'olive oil',
  'nước tương': 'soy sauce', 'tương ớt': 'chili sauce sriracha',
  'mù tạt': 'mustard', 'mayonnaise': 'mayonnaise',
  'nước dừa': 'coconut water', 'sữa dừa': 'coconut milk',
  'mắm tôm': 'shrimp paste', 'mắm ruốc': 'shrimp paste',
  'mắm cá': 'fish paste', 'mắm ba khía': 'crab paste',
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

// ─── Image sources ───────────────────────────────────────────────────────────

async function searchWikimediaCommons(name: string): Promise<string | null> {
  try {
    const queries = [name, toEn(name)];
    for (const q of queries) {
      const url = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q + ' food ingredient')}&srnamespace=6&srlimit=3&format=json&origin=*`;
      const res = await httpGet(url, 10000);
      if (res.status !== 200) continue;
      const json = JSON.parse(res.data.toString('utf-8'));
      const hits = json?.query?.search ?? [];
      for (const hit of hits) {
        const title = hit.title; // "File:xxx.jpg"
        const imgUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&iiurlwidth=500&format=json&origin=*`;
        const imgRes = await httpGet(imgUrl, 10000);
        if (imgRes.status !== 200) continue;
        const imgJson = JSON.parse(imgRes.data.toString('utf-8'));
        const pages = imgJson?.query?.pages ?? {};
        for (const page of Object.values(pages) as any[]) {
          const thumbUrl = page?.imageinfo?.[0]?.thumburl;
          if (thumbUrl) return thumbUrl;
        }
      }
    }
  } catch { /* ignore */ }
  return null;
}

async function searchWikipedia(name: string, lang: 'vi' | 'en'): Promise<string | null> {
  try {
    const q = lang === 'vi' ? name : toEn(name);
    const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=3&format=json&origin=*`;
    const searchRes = await httpGet(searchUrl, 10000);
    if (searchRes.status !== 200) return null;
    const hits = JSON.parse(searchRes.data.toString('utf-8'))?.query?.search ?? [];
    if (!hits.length) return null;

    for (const hit of hits.slice(0, 2)) {
      const pageTitle = hit.title;
      const imgUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&pithumbsize=500&format=json&origin=*`;
      const imgRes = await httpGet(imgUrl, 10000);
      if (imgRes.status !== 200) continue;
      const pages = JSON.parse(imgRes.data.toString('utf-8'))?.query?.pages ?? {};
      for (const page of Object.values(pages) as any[]) {
        if (page.thumbnail?.source) return page.thumbnail.source;
      }
    }
  } catch { /* ignore */ }
  return null;
}

async function searchUnsplash(name: string): Promise<string | null> {
  if (!UNSPLASH_KEY) return null;
  try {
    const q = encodeURIComponent(toEn(name) + ' food ingredient');
    const res = await httpGet(`https://api.unsplash.com/search/photos?query=${q}&per_page=3&orientation=squarish`, 10000);
    if (res.status !== 200) return null;
    const results = JSON.parse(res.data.toString('utf-8'))?.results ?? [];
    if (!results.length) return null;
    // Score by keyword match
    const en = toEn(name).toLowerCase();
    let best = results[0];
    let bestScore = 0;
    for (const r of results) {
      const desc = ((r.alt_description ?? '') + ' ' + (r.description ?? '')).toLowerCase();
      const score = en.split(' ').filter(k => k.length > 3 && desc.includes(k)).length;
      if (score > bestScore) { bestScore = score; best = r; }
    }
    return best.urls?.regular ?? null;
  } catch { return null; }
}

async function findImage(name: string, useUnsplash: boolean): Promise<string | null> {
  // 1. Wikipedia VI
  const wVI = await searchWikipedia(name, 'vi');
  if (wVI) return wVI;

  // 2. Wikipedia EN
  const wEN = await searchWikipedia(name, 'en');
  if (wEN) return wEN;

  // 3. Wikimedia Commons
  const wmc = await searchWikimediaCommons(name);
  if (wmc) return wmc;

  // 4. Unsplash (only if quota available)
  if (useUnsplash) {
    const usp = await searchUnsplash(name);
    if (usp) return usp;
  }

  return null;
}

// ─── Upload ──────────────────────────────────────────────────────────────────

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some(b => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, { public: true });
  }
}

async function downloadAndUpload(imgUrl: string, code: string): Promise<{ url: string; key: string } | null> {
  try {
    const res = await httpGet(imgUrl, 20000);
    if (res.status !== 200 || !res.data.length) return null;
    const ct = res.headers['content-type'] ?? 'image/jpeg';
    const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
    const key = `${code.toLowerCase().replace(/[^a-z0-9-]/g, '-')}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(key, res.data, { contentType: ct, upsert: true });
    if (error) return null;
    return { url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${key}`, key };
  } catch { return null; }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  await ensureBucket();

  // Load all ingredients without image
  const items = await db.ingredient.findMany({
    where: { imageUrl: null },
    select: { id: true, name: true, code: true },
    orderBy: { code: 'asc' },
  });

  console.log(`🔍 Cần tìm ảnh cho ${items.length} nguyên liệu\n`);

  let found = 0, uploaded = 0, noImg = 0;
  let unsplashUsed = 0;
  const MAX_UNSPLASH = 40; // stay under 50/hr limit

  const startTime = Date.now();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const prog = `[${(i + 1).toString().padStart(4)}/${items.length}]`;
    const useUnsplash = unsplashUsed < MAX_UNSPLASH;

    process.stdout.write(`${prog} ${item.name}...`);

    const imgUrl = await findImage(item.name, useUnsplash);
    if (!imgUrl) {
      noImg++;
      process.stdout.write(` ✗\n`);
      await sleep(100);
      continue;
    }

    found++;
    if (imgUrl.includes('api.unsplash.com') || imgUrl.includes('images.unsplash.com')) {
      unsplashUsed++;
    }

    // Try upload
    const up = await downloadAndUpload(imgUrl, item.code);
    if (up) {
      uploaded++;
      await db.ingredient.update({
        where: { id: item.id },
        data: { imageUrl: up.url, imageKey: up.key },
      });
      process.stdout.write(` ✅ ${up.key}\n`);
    } else {
      // Fallback: save external URL directly
      await db.ingredient.update({
        where: { id: item.id },
        data: { imageUrl: imgUrl },
      });
      process.stdout.write(` ⚡ url\n`);
      found++; // counted as found
    }

    // Rate limiting
    await sleep(400);

    if ((i + 1) % 50 === 0) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`\n  📊 Progress: ${i + 1}/${items.length} | found=${found} uploaded=${uploaded} noImg=${noImg} | ${elapsed}s\n`);
    }
  }

  console.log('\n═══════════════════════════════════════════');
  console.log(`✅ Tìm được ảnh     : ${found}/${items.length}`);
  console.log(`⬆️  Upload Supabase  : ${uploaded}`);
  console.log(`✗  Không có ảnh    : ${noImg}`);
  console.log(`⏱️  Thời gian        : ${Math.round((Date.now() - startTime) / 1000)}s`);

  const withImg = await db.ingredient.count({ where: { imageUrl: { not: null } } });
  const total = await db.ingredient.count();
  console.log(`📊 Có ảnh trong DB  : ${withImg}/${total}`);
}

main().catch(console.error).finally(async () => {
  await db.$disconnect();
  await pool.end();
});
