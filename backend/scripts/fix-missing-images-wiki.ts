/**
 * Script: fix-missing-images-wiki.ts
 * Dùng Wikipedia ONLY (không cần API key), search cả VI + EN
 * Dishes: upload Supabase Storage | Ingredients: lưu URL trực tiếp
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as https from 'https';
import * as http from 'http';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const STORAGE_BUCKET = 'dish-images';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
function fetchJson(url: string): Promise<any> {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'MoguBot/1.0 (contact@mogu.vn)' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.headers.location) {
        fetchJson(res.headers.location as string).then(resolve); return;
      }
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(10000, () => { req.destroy(); resolve(null); });
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
    req.setTimeout(15000, () => { req.destroy(); resolve(null); });
  });
}

// ─── Wikipedia search ──────────────────────────────────────────────────────────
async function wikiImage(query: string, lang = 'vi'): Promise<string | null> {
  try {
    const s = await fetchJson(
      `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=3&format=json`,
    );
    const titles: string[] = s?.[1] ?? [];
    for (const title of titles) {
      const d = await fetchJson(
        `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=800`,
      );
      const page: any = Object.values(d?.query?.pages ?? {})[0];
      if (page?.thumbnail?.source) return page.thumbnail.source;
    }
  } catch { /* ignore */ }
  return null;
}

// ─── Mapping VI → EN queries ──────────────────────────────────────────────────
const DISH_EN: Record<string, string> = {
  'phở bò': 'pho Vietnamese beef noodle soup',
  'bún bò': 'bun bo hue Vietnamese spicy noodle',
  'bún riêu': 'bun rieu Vietnamese crab tomato noodle',
  'bún thịt nướng': 'Vietnamese grilled pork rice noodle salad',
  'bún đậu': 'bun dau mam tom Vietnamese tofu noodle',
  'bánh canh': 'banh canh Vietnamese thick noodle soup',
  'mì quảng': 'mi quang Vietnamese turmeric noodle Quang Nam',
  'cơm tấm': 'com tam Vietnamese broken rice pork',
  'cơm chiên': 'Vietnamese fried rice yang chow style',
  'cơm gà': 'com ga Hoi An Vietnamese chicken rice',
  'cá kho': 'ca kho to Vietnamese caramelized fish',
  'thịt kho': 'thit kho Vietnamese braised pork eggs coconut',
  'bò kho': 'bo kho Vietnamese beef stew carrots',
  'gà kho': 'ga kho gung Vietnamese ginger chicken',
  'chả giò': 'cha gio Vietnamese fried spring rolls',
  'bánh xèo': 'banh xeo Vietnamese sizzling crepe',
  'bánh khọt': 'banh khot Vietnamese mini pancake coconut',
  'gỏi cuốn': 'goi cuon Vietnamese fresh spring rolls',
  'cao lầu': 'cao lau Hoi An Vietnamese noodle',
  'bánh cuốn': 'banh cuon Vietnamese steamed rice roll',
};

const ING_EN: Record<string, string> = {
  'bánh tráng nướng': 'grilled rice paper Vietnamese street food',
  'bột năng': 'tapioca starch white powder cooking',
  'bột ngọt': 'monosodium glutamate MSG seasoning',
  'chả lụa': 'Vietnamese steamed pork sausage gio lua',
  'chanh hoặc quất': 'lime kumquat citrus Vietnam',
  'củ cải trắng': 'daikon radish white Asian vegetable',
  'dấm bỗng': 'Vietnamese fermented rice vinegar sour',
  'đậu phộng rang': 'roasted peanuts Asian condiment',
  'đinh hương': 'cloves whole spice dried aromatic',
  'gạo tẻ': 'jasmine white rice Vietnamese grain',
  'giấm bỗng': 'Vietnamese rice bong vinegar fermented',
  'giấm gạo': 'rice vinegar Asian cooking condiment',
  'hành phi': 'fried shallots crispy Vietnamese topping',
  'hạt thì là': 'dill seeds herb spice cooking',
  'hạt tiêu xay': 'ground black pepper spice seasoning',
  'húng láng': 'Vietnamese perilla fresh herb garden',
  'húng quế': 'Thai basil Asian fresh herb',
  'mẻ': 'Vietnamese fermented rice sour cơm mẻ',
  'mì chính': 'MSG umami seasoning white powder',
  'mì quảng': 'Vietnamese yellow noodle turmeric wide flat',
  'mộc nhĩ': 'wood ear mushroom black fungus dried',
  'mùi tàu': 'Vietnamese coriander sawtooth herb ngò gai',
  'nước ấm': 'warm water glass cup liquid',
  'nước cốt chanh': 'lime juice squeeze citrus fresh',
  'nước dùng gà': 'chicken broth stock homemade soup',
  'quế thanh': 'cinnamon sticks spice bark aromatic',
  'rau ăn kèm': 'Vietnamese fresh herb plate mixed greens',
  'rau đắng': 'Vietnamese bitter herb wild leaf',
  'rau giá đỗ': 'bean sprouts fresh Vietnamese',
  'rau rút': 'Vietnamese aquatic herb water plant',
  'rau thơm': 'Vietnamese fresh herb mixed assorted plate',
  'thịt ba chỉ': 'pork belly slice Vietnamese cooking',
  'thịt heo ba chỉ': 'Vietnamese pork belly strip raw',
  'tía tô': 'perilla shiso Vietnamese herb purple green',
  'trứng vịt': 'duck egg Vietnamese oval food',
  'xà lách': 'fresh lettuce green leaves salad',
  'xương bò': 'beef bones for pho Vietnamese broth',
  'xương ống bò': 'beef marrow bones pho stock Vietnamese',
};

function getEnQuery(name: string, isDish: boolean): string {
  const lower = name.toLowerCase()
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*(miền\s+\w+|hội\s+an|hà\s+nội|sài\s+gòn)/gi, '')
    .trim();
  const map = isDish ? DISH_EN : ING_EN;
  for (const [vi, en] of Object.entries(map)) {
    if (lower.includes(vi)) return en;
  }
  // Fallback: tên cleaned + Vietnamese
  return `${lower} Vietnamese food ingredient`;
}

async function findWikiImage(name: string, isDish: boolean): Promise<string | null> {
  const cleaned = name.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  const enQuery = getEnQuery(name, isDish);

  // 1. Wikipedia VI (tên cleaned)
  let url = await wikiImage(cleaned, 'vi');
  if (url) { console.log(`  [Wiki VI] "${cleaned}"`); return url; }
  await delay(200);

  // 2. Wikipedia EN (tên mapped)
  url = await wikiImage(enQuery, 'en');
  if (url) { console.log(`  [Wiki EN] "${cleaned}"`); return url; }
  await delay(200);

  // 3. Wikipedia EN (tên cleaned trực tiếp)
  url = await wikiImage(cleaned, 'en');
  if (url) { console.log(`  [Wiki EN2] "${cleaned}"`); return url; }

  console.log(`  ✗ "${name}"`);
  return null;
}

// ─── Supabase upload ──────────────────────────────────────────────────────────
async function uploadToSupabase(imageUrl: string, path: string): Promise<string | null> {
  const res = await fetchBuffer(imageUrl);
  if (!res) return null;
  const { buffer, contentType } = res;
  const mimeType = contentType.split(';')[0].trim();
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType)) return null;

  return new Promise((resolve) => {
    const u = new URL(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`);
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': mimeType === 'image/gif' ? 'image/jpeg' : mimeType,
        'Content-Length': buffer.length,
        'x-upsert': 'true',
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if ((res.statusCode ?? 0) < 300) resolve(path);
        else { console.error(`    Upload failed ${res.statusCode}: ${data.substring(0, 120)}`); resolve(null); }
      });
    });
    req.on('error', (e) => { console.error('    Upload err:', e.message); resolve(null); });
    req.write(buffer);
    req.end();
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔍 Scanning DB for missing images (Wikipedia only)...\n');

  // ── Ingredients ──────────────────────────────────────────────────────────
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
    const imgUrl = await findWikiImage(ing.name, false);
    if (imgUrl) {
      await (prisma as any).ingredient.update({ where: { id: ing.id }, data: { imageUrl: imgUrl } });
      ingFixed++;
    }
    await delay(350);
  }
  console.log(`\n✅ Ingredients: fixed ${ingFixed}/${ingsMissing.length}\n`);

  // ── Dishes ────────────────────────────────────────────────────────────────
  const dishesAll: any[] = await (prisma as any).dish.findMany({
    where: { deletedAt: null },
    select: {
      id: true, name: true,
      media: { where: { isPrimary: true }, select: { id: true }, take: 1 },
    },
  });
  const dishesMissing = dishesAll.filter((d: any) => d.media.length === 0);
  console.log(`🍜 Dishes thiếu ảnh: ${dishesMissing.length}/${dishesAll.length}`);

  let dishFixed = 0;
  for (let i = 0; i < dishesMissing.length; i++) {
    const dish = dishesMissing[i];
    process.stdout.write(`[${i + 1}/${dishesMissing.length}] ${dish.name}... `);
    const imgUrl = await findWikiImage(dish.name, true);
    if (imgUrl) {
      const ext = imgUrl.includes('.png') ? 'png' : imgUrl.includes('.webp') ? 'webp' : 'jpg';
      const storageKey = `dishes/${dish.id}/cover-wiki-${Date.now()}.${ext}`;
      const uploaded = await uploadToSupabase(imgUrl, storageKey);
      if (uploaded) {
        await (prisma as any).dishMedia.create({
          data: {
            dishId: dish.id, type: 'IMAGE', storageKey: uploaded,
            bucket: STORAGE_BUCKET, mimeType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
            sizeBytes: 0, altText: dish.name, credit: 'Wikipedia',
            sourceUrl: imgUrl, isPrimary: true, moderationStatus: 'APPROVED', sortOrder: 0,
          },
        });
        console.log(`  → OK`);
        dishFixed++;
      }
    }
    await delay(500);
  }

  // ─── Tổng kết ─────────────────────────────────────────────────────────────
  const remainIng: number = await (prisma as any).ingredient.count({
    where: { OR: [{ imageUrl: null }, { imageUrl: '' }], isActive: true },
  });
  const totalDishes: number = await (prisma as any).dish.count({ where: { deletedAt: null } });
  const dishesHaveImg: number = await (prisma as any).dishMedia.count({ where: { isPrimary: true } });

  console.log(`\n=== KẾT QUẢ ===`);
  console.log(`Ingredients: +${ingFixed} ảnh | còn thiếu: ${remainIng}`);
  console.log(`Dishes: +${dishFixed} ảnh | có ảnh: ${dishesHaveImg}/${totalDishes}`);
  console.log('Done!');

  await (prisma as any).$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
