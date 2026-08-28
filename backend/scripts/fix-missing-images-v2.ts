/**
 * Script: fix-missing-images-v2.ts
 * Approach mới: dùng tiếng Anh làm primary, Wikipedia làm fallback
 * Run: npx ts-node -r tsconfig-paths/register scripts/fix-missing-images-v2.ts
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as https from 'https';
import * as http from 'http';

const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY ?? '';
const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const STORAGE_BUCKET = 'dish-images';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
function fetchJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'MoguBot/1.0', ...headers } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.headers.location) {
        fetchJson(res.headers.location, headers).then(resolve);
        return;
      }
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
  });
}

function fetchBuffer(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'MoguBot/1.0' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.headers.location) {
        fetchBuffer(res.headers.location as string).then(resolve); return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: res.headers['content-type'] ?? 'image/jpeg' }));
    });
    req.on('error', () => resolve(null));
    req.setTimeout(12000, () => { req.destroy(); resolve(null); });
  });
}

// ─── Image search ──────────────────────────────────────────────────────────────
async function searchUnsplash(query: string): Promise<string | null> {
  if (!UNSPLASH_KEY) return null;
  try {
    const data = await fetchJson(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`,
      { Authorization: `Client-ID ${UNSPLASH_KEY}` },
    );
    const results: any[] = data?.results ?? [];
    if (!results.length) return null;
    const kws = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
    let best = results[0];
    let bestScore = -1;
    for (const r of results) {
      const desc = `${r.alt_description ?? ''} ${r.description ?? ''}`.toLowerCase();
      const score = kws.filter(k => desc.includes(k)).length;
      if (score > bestScore) { bestScore = score; best = r; }
    }
    return best?.urls?.regular ?? null;
  } catch { return null; }
}

async function searchWikipedia(query: string, lang = 'vi'): Promise<string | null> {
  try {
    const searchData = await fetchJson(
      `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=3&format=json`,
    );
    const titles: string[] = searchData?.[1] ?? [];
    if (!titles.length) return null;
    for (const title of titles) {
      const imgData = await fetchJson(
        `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=600`,
      );
      const pages = imgData?.query?.pages ?? {};
      const page: any = Object.values(pages)[0];
      if (page?.thumbnail?.source) return page.thumbnail.source;
    }
    return null;
  } catch { return null; }
}

// ─── English query mapping ────────────────────────────────────────────────────
/** Lấy tiếng Anh để search Unsplash/Wikipedia EN */
function toEnglish(name: string): string {
  const cleaned = name
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*(miền\s+\w+|hội\s+an|quảng\s+\w+|hà\s+nội|sài\s+gòn|vũng\s+tàu|nam\s+bộ|bắc\s+bộ)/gi, '')
    .replace(/\s+/g, ' ').trim().toLowerCase();

  // Món ăn
  const dishMap: Record<string, string> = {
    'phở bò': 'Vietnamese pho beef noodle soup',
    'bún bò': 'bun bo hue spicy beef noodle Vietnam',
    'bún riêu cua': 'Vietnamese bun rieu crab tomato noodle soup',
    'bún thịt nướng': 'Vietnamese grilled pork vermicelli salad bowl',
    'bún đậu mắm tôm': 'Vietnamese bun dau mam tom fried tofu shrimp paste',
    'bánh canh cua': 'Vietnamese thick noodle soup crab banh canh',
    'mì quảng': 'Vietnamese mi quang turmeric noodle dish',
    'cơm tấm sườn': 'Vietnamese broken rice grilled pork com tam',
    'cơm chiên dương châu': 'Vietnamese fried rice yang chow',
    'cơm gà': 'Vietnamese chicken rice com ga',
    'cá kho tộ': 'Vietnamese caramelized fish clay pot',
    'thịt kho trứng': 'Vietnamese pork braised eggs caramel sauce',
    'bò kho': 'Vietnamese beef stew bo kho carrots',
    'gà kho gừng': 'Vietnamese ginger chicken braised',
    'chả giò': 'Vietnamese fried spring rolls cha gio',
    'bánh xèo': 'Vietnamese sizzling crepe banh xeo shrimp pork',
    'bánh khọt': 'Vietnamese mini coconut pancake banh khot',
    'gỏi cuốn tôm thịt': 'Vietnamese fresh spring rolls shrimp pork goi cuon',
    'cao lầu': 'Vietnamese cao lau hoi an noodle pork',
    'bánh cuốn': 'Vietnamese steamed rice roll banh cuon',
  };
  for (const [vi, en] of Object.entries(dishMap)) {
    if (cleaned.includes(vi)) return en;
  }

  // Nguyên liệu
  const ingMap: Record<string, string> = {
    'bánh tráng': 'Vietnamese rice paper spring roll wrapper',
    'bột năng': 'tapioca starch flour white powder',
    'bột ngọt': 'MSG monosodium glutamate seasoning',
    'chả lụa': 'Vietnamese pork sausage gio lua steamed',
    'chanh': 'lime lemon citrus fruit',
    'củ cải trắng': 'daikon radish white root vegetable',
    'dấm bỗng': 'Vietnamese fermented rice vinegar',
    'đậu phộng rang': 'roasted peanuts Vietnamese condiment',
    'đinh hương': 'cloves spice dried flower',
    'gạo tẻ': 'jasmine white rice Vietnamese',
    'giấm bỗng': 'Vietnamese rice vinegar fermented',
    'giấm gạo': 'rice vinegar Asian condiment',
    'hành phi': 'Vietnamese fried shallots crispy',
    'hạt thì là': 'dill seeds herb spice',
    'hạt tiêu xay': 'ground black pepper spice',
    'húng láng': 'Vietnamese perilla herb mint leaves',
    'húng quế': 'Thai basil Vietnamese herb leaves',
    'mẻ': 'Vietnamese fermented rice sour paste',
    'mì chính': 'MSG umami seasoning powder',
    'mì quảng': 'Vietnamese yellow noodle turmeric',
    'mộc nhĩ': 'wood ear mushroom black fungus dried',
    'mùi tàu': 'Vietnamese coriander sawtooth herb ngo gai',
    'nước ấm': 'warm water cup liquid',
    'nước cốt chanh': 'lime juice citrus squeeze',
    'nước dùng gà': 'chicken broth stock soup base',
    'quế thanh': 'cinnamon sticks spice bark',
    'rau ăn kèm': 'Vietnamese fresh herb vegetable platter',
    'rau đắng': 'Vietnamese bitter herb rau dang',
    'rau giá đỗ': 'bean sprouts Vietnamese fresh',
    'rau rút': 'Vietnamese water herb ngổ aquatic',
    'rau thơm': 'Vietnamese fresh herbs mixed assorted',
    'thịt ba chỉ': 'Vietnamese pork belly thit ba chi',
    'thịt heo ba chỉ': 'pork belly sliced Vietnamese cooking',
    'tía tô': 'perilla shiso leaf Vietnamese herb',
    'trứng vịt': 'duck egg Vietnamese oval',
    'xà lách': 'lettuce green salad leaves',
    'xương bò': 'beef bones broth Vietnamese pho',
    'xương ống bò': 'beef marrow bones pho broth stock',
  };
  for (const [vi, en] of Object.entries(ingMap)) {
    if (cleaned.includes(vi)) return en;
  }

  // Generic fallback: dùng tên gốc + Vietnamese food
  return `${cleaned} Vietnamese food`;
}

async function findBestImage(name: string): Promise<string | null> {
  const enQuery = toEnglish(name);
  const cleaned = name.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();

  // 1. Unsplash tiếng Anh (primary)
  let url = await searchUnsplash(enQuery);
  if (url) { console.log(`  [Unsplash EN] ✓ "${cleaned}"`); return url; }
  await delay(300);

  // 2. Wikipedia VI
  url = await searchWikipedia(cleaned, 'vi');
  if (url) { console.log(`  [Wiki VI] ✓ "${cleaned}"`); return url; }
  await delay(300);

  // 3. Wikipedia EN
  url = await searchWikipedia(enQuery, 'en');
  if (url) { console.log(`  [Wiki EN] ✓ "${cleaned}"`); return url; }
  await delay(300);

  // 4. Unsplash với tên cleaned tiếng Việt
  url = await searchUnsplash(cleaned);
  if (url) { console.log(`  [Unsplash VI] ✓ "${cleaned}"`); return url; }

  console.log(`  ✗ "${name}"`);
  return null;
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── Supabase upload ──────────────────────────────────────────────────────────
async function uploadToSupabase(imageUrl: string, path: string): Promise<string | null> {
  const res = await fetchBuffer(imageUrl);
  if (!res) return null;
  const { buffer, contentType } = res;
  const mimeType = contentType.split(';')[0].trim();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return null;

  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`;
  return new Promise((resolve) => {
    const u = new URL(uploadUrl);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': mimeType,
        'Content-Length': buffer.length,
        'x-upsert': 'true',
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if ((res.statusCode ?? 0) < 300) resolve(path);
        else { console.error(`    Upload failed ${res.statusCode}: ${data.substring(0, 100)}`); resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.write(buffer);
    req.end();
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔍 Scanning DB for missing images...\n');

  // ── 1. Ingredients ─────────────────────────────────────────────────────────
  const ingsMissing: any[] = await (prisma as any).ingredient.findMany({
    where: { OR: [{ imageUrl: null }, { imageUrl: '' }], isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  console.log(`📦 Ingredients thiếu ảnh: ${ingsMissing.length}`);

  let ingFixed = 0;
  for (let i = 0; i < ingsMissing.length; i++) {
    const ing = ingsMissing[i];
    process.stdout.write(`[${i + 1}/${ingsMissing.length}] ${ing.name}... `);
    const imgUrl = await findBestImage(ing.name);
    if (imgUrl) {
      await (prisma as any).ingredient.update({ where: { id: ing.id }, data: { imageUrl: imgUrl } });
      ingFixed++;
    }
    await delay(400);
  }
  console.log(`\n✅ Ingredients: fixed ${ingFixed}/${ingsMissing.length}\n`);

  // ── 2. Dishes ──────────────────────────────────────────────────────────────
  const dishesWithMedia: any[] = await (prisma as any).dish.findMany({
    where: { deletedAt: null },
    select: {
      id: true, name: true,
      media: { where: { isPrimary: true }, select: { id: true }, take: 1 },
    },
  });
  const dishesMissing = dishesWithMedia.filter((d: any) => d.media.length === 0);
  console.log(`🍜 Dishes thiếu ảnh: ${dishesMissing.length}/${dishesWithMedia.length}`);

  let dishFixed = 0;
  for (let i = 0; i < dishesMissing.length; i++) {
    const dish = dishesMissing[i];
    process.stdout.write(`[${i + 1}/${dishesMissing.length}] ${dish.name}... `);
    const imgUrl = await findBestImage(dish.name);
    if (imgUrl) {
      const ext = imgUrl.includes('.png') ? 'png' : imgUrl.includes('.webp') ? 'webp' : 'jpg';
      const storageKey = `dishes/${dish.id}/cover-auto-${Date.now()}.${ext}`;
      const uploaded = await uploadToSupabase(imgUrl, storageKey);
      if (uploaded) {
        await (prisma as any).dishMedia.create({
          data: {
            dishId: dish.id,
            type: 'IMAGE',
            storageKey: uploaded,
            bucket: STORAGE_BUCKET,
            mimeType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
            sizeBytes: 0,
            altText: dish.name,
            credit: 'Unsplash / Wikipedia',
            sourceUrl: imgUrl,
            isPrimary: true,
            moderationStatus: 'APPROVED',
            sortOrder: 0,
          },
        });
        console.log(`  → uploaded`);
        dishFixed++;
      }
    }
    await delay(600);
  }

  console.log(`\n=== KẾT QUẢ CUỐI ===`);
  console.log(`Ingredients: +${ingFixed} ảnh mới`);
  console.log(`Dishes: +${dishFixed} ảnh mới`);

  // Stats
  const totalIngNoImg: number = await (prisma as any).ingredient.count({
    where: { OR: [{ imageUrl: null }, { imageUrl: '' }], isActive: true },
  });
  console.log(`Ingredients vẫn chưa có ảnh: ${totalIngNoImg}`);
  console.log('Done!');

  await (prisma as any).$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
