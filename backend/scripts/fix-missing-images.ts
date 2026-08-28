/**
 * Script: fix-missing-images.ts
 * Tìm tất cả Dishes và Ingredients thiếu ảnh → search Unsplash/Wikipedia → cập nhật DB
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as https from 'https';
import * as http from 'http';

// ─── env ────────────────────────────────────────────────────────────────────
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY ?? '';
const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const STORAGE_BUCKET = 'dish-images';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

// ─── HTTP helpers ────────────────────────────────────────────────────────────
function fetchJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'MoguBot/1.0', ...headers } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function fetchBuffer(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'MoguBot/1.0' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchBuffer(res.headers.location).then(resolve);
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({
        buffer: Buffer.concat(chunks),
        contentType: res.headers['content-type'] ?? 'image/jpeg',
      }));
    });
    req.on('error', () => resolve(null));
    req.setTimeout(10000, () => { req.destroy(); resolve(null); });
  });
}

// ─── Image search ────────────────────────────────────────────────────────────
async function searchUnsplash(query: string): Promise<string | null> {
  if (!UNSPLASH_KEY) return null;
  try {
    const data = await fetchJson(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`,
      { Authorization: `Client-ID ${UNSPLASH_KEY}` },
    );
    if (!data?.results?.length) return null;
    const results: any[] = data.results;
    // Score by keyword match
    const kws = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
    let best = results[0];
    let bestScore = 0;
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
    if (!searchData?.[1]?.length) return null;
    const title = searchData[1][0];
    const imgData = await fetchJson(
      `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=600`,
    );
    const pages = imgData?.query?.pages ?? {};
    const page = Object.values(pages)[0] as any;
    return page?.thumbnail?.source ?? null;
  } catch { return null; }
}

/** Làm sạch tên: bỏ nội dung trong ngoặc (), bỏ suffix vùng miền */
function cleanName(name: string): string {
  return name
    .replace(/\s*\([^)]*\)/g, '')           // bỏ ngoặc đơn: "Thịt kho trứng (miền Nam)" → "Thịt kho trứng"
    .replace(/\s*(miền\s+\w+|hội\s+an|quảng\s+\w+|hà\s+nội|sài\s+gòn|vũng\s+tàu)/gi, '') // bỏ tên vùng
    .replace(/\s+/g, ' ')
    .trim();
}

/** Mapping tên sang tiếng Anh để search Wikipedia/Unsplash EN */
const VI_TO_EN: Record<string, string> = {
  'phở bò': 'Vietnamese pho beef noodle soup',
  'bún bò': 'Vietnamese bun bo hue spicy beef noodle',
  'bún riêu': 'Vietnamese bun rieu cua tomato crab noodle',
  'bún thịt nướng': 'Vietnamese grilled pork rice noodle salad',
  'bánh canh': 'Vietnamese thick noodle soup banh canh',
  'mì quảng': 'Vietnamese mi quang noodle turmeric',
  'cơm tấm': 'Vietnamese broken rice com tam',
  'cơm chiên': 'Vietnamese fried rice',
  'cơm gà': 'Vietnamese chicken rice',
  'cá kho': 'Vietnamese caramelized fish clay pot',
  'thịt kho': 'Vietnamese caramelized pork eggs braised',
  'bò kho': 'Vietnamese braised beef stew bo kho',
  'gà kho': 'Vietnamese braised ginger chicken',
  'chả giò': 'Vietnamese spring rolls cha gio nem ran',
  'bánh xèo': 'Vietnamese sizzling crepe banh xeo',
  'bánh khọt': 'Vietnamese mini savory pancake banh khot',
  'gỏi cuốn': 'Vietnamese fresh spring rolls goi cuon',
  'bún đậu': 'Vietnamese bun dau mam tom fried tofu',
  'cao lầu': 'Vietnamese cao lau hoi an noodle',
  'bánh cuốn': 'Vietnamese steamed rice roll banh cuon',
  // Ingredients
  'chả lụa': 'Vietnamese pork roll gio lua',
  'giấm bỗng': 'Vietnamese fermented rice vinegar',
  'mẻ': 'Vietnamese fermented rice mash me chua',
  'mộc nhĩ': 'wood ear mushroom black fungus',
  'tía tô': 'Vietnamese perilla herb tia to',
  'rau đắng': 'Vietnamese bitter herb rau dang',
  'đinh hương': 'cloves spice đinh hương',
  'hạt thì là': 'dill seeds fennel seeds',
  'bột năng': 'tapioca starch flour',
  'bột ngọt': 'monosodium glutamate MSG',
  'gạo tẻ': 'Vietnamese jasmine rice',
  'mì chính': 'monosodium glutamate MSG umami',
  'trứng vịt': 'duck egg Vietnamese',
  'xương bò': 'beef bones broth pho',
  'xương ống': 'beef marrow bones pho broth',
};

async function findImage(name: string, isIngredient = false): Promise<string | null> {
  const cleaned = cleanName(name);
  const lowerCleaned = cleaned.toLowerCase();

  // Tìm English query từ mapping
  let enQuery: string | null = null;
  for (const [vi, en] of Object.entries(VI_TO_EN)) {
    if (lowerCleaned.includes(vi)) { enQuery = en; break; }
  }

  // 1. Unsplash với tên đã clean
  let url = await searchUnsplash(cleaned);
  if (url) { console.log(`  Unsplash ✓ "${cleaned}"`); return url; }

  // 2. Wikipedia VI với tên đã clean
  url = await searchWikipedia(cleaned, 'vi');
  if (url) { console.log(`  Wikipedia VI ✓ "${cleaned}"`); return url; }

  // 3. Unsplash tiếng Anh (nếu có mapping)
  if (enQuery) {
    url = await searchUnsplash(enQuery);
    if (url) { console.log(`  Unsplash EN ✓ "${cleaned}"`); return url; }

    // 4. Wikipedia EN với tên mapped
    url = await searchWikipedia(enQuery, 'en');
    if (url) { console.log(`  Wikipedia EN ✓ "${cleaned}"`); return url; }
  }

  // 5. Fallback: Unsplash với tên gốc + "Vietnamese food"
  url = await searchUnsplash(`${cleaned} Vietnamese food`);
  if (url) { console.log(`  Unsplash fallback ✓ "${cleaned}"`); return url; }

  console.log(`  ✗ Không tìm được ảnh cho: ${name}`);
  return null;
}

// ─── Supabase upload ─────────────────────────────────────────────────────────
async function uploadToSupabase(imageUrl: string, path: string): Promise<string | null> {
  const res = await fetchBuffer(imageUrl);
  if (!res) return null;
  const { buffer, contentType } = res;
  const mimeType = contentType.split(';')[0].trim();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return null;

  // Upload via Supabase Storage REST API
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`;
  return new Promise((resolve) => {
    const url = new URL(uploadUrl);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': mimeType,
        'Content-Length': buffer.length,
        'x-upsert': 'true',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve(path);
        } else {
          console.error(`    Upload failed ${res.statusCode}: ${data.substring(0, 100)}`);
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.write(buffer);
    req.end();
  });
}

function getPublicUrl(storageKey: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${storageKey}`;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔍 Kiểm tra DB để tìm items thiếu ảnh...\n');

  // ── 1. Ingredients thiếu imageUrl ────────────────────────────────────────
  const ingsMissing = await prisma.ingredient.findMany({
    where: { OR: [{ imageUrl: null }, { imageUrl: '' }], isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  console.log(`📦 Ingredients thiếu ảnh: ${ingsMissing.length}`);

  let ingFixed = 0;
  for (let i = 0; i < ingsMissing.length; i++) {
    const ing = ingsMissing[i];
    process.stdout.write(`[${i + 1}/${ingsMissing.length}] ${ing.name}... `);
    const imgUrl = await findImage(ing.name, true);
    if (imgUrl) {
      await prisma.ingredient.update({
        where: { id: ing.id },
        data: { imageUrl: imgUrl },
      });
      ingFixed++;
    }
    // Rate limit delay
    await new Promise(r => setTimeout(r, 400));
  }
  console.log(`\n✅ Ingredients: đã fix ${ingFixed}/${ingsMissing.length}\n`);

  // ── 2. Dishes thiếu DishMedia (primary image) ─────────────────────────────
  const dishesWithMedia = await prisma.dish.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      media: { where: { isPrimary: true }, select: { id: true, storageKey: true }, take: 1 },
    },
  });
  const dishesMissing = dishesWithMedia.filter((d: any) => d.media.length === 0);
  console.log(`🍜 Dishes thiếu ảnh: ${dishesMissing.length}/${dishesWithMedia.length}`);

  let dishFixed = 0;
  for (let i = 0; i < dishesMissing.length; i++) {
    const dish = dishesMissing[i];
    process.stdout.write(`[${i + 1}/${dishesMissing.length}] ${dish.name}... `);
    const imgUrl = await findImage(dish.name);
    if (imgUrl) {
      // Upload to Supabase Storage
      const ext = imgUrl.includes('.png') ? 'png' : imgUrl.includes('.webp') ? 'webp' : 'jpg';
      const storageKey = `dishes/${dish.id}/cover-${Date.now()}.${ext}`;
      const uploadedKey = await uploadToSupabase(imgUrl, storageKey);
      if (uploadedKey) {
        // Create DishMedia record
        await prisma.dishMedia.create({
          data: {
            dishId: dish.id,
            type: 'IMAGE',
            storageKey: uploadedKey,
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
        console.log(`  ✅ Uploaded → ${uploadedKey}`);
        dishFixed++;
      }
    }
    await new Promise(r => setTimeout(r, 500));
  }
  console.log(`\n✅ Dishes: đã fix ${dishFixed}/${dishesMissing.length}`);

  // ─── Tổng kết ───────────────────────────────────────────────────────────
  console.log('\n=== KẾT QUẢ ===');
  console.log(`Ingredients: ${ingFixed} ảnh mới`);
  console.log(`Dishes: ${dishFixed} ảnh mới`);
  console.log('Done!');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
