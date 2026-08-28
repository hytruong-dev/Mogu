/**
 * fix-remaining-images.ts — xử lý các items cứng đầu còn lại
 * Dùng keyword đơn giản nhất để search Wikipedia + EN fallback
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
const p = new PrismaClient({ adapter } as any);

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'MoguBot/1.0' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.headers.location) { fetchJson(res.headers.location as string).then(resolve); return; }
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null)); req.setTimeout(10000, () => { req.destroy(); resolve(null); });
  });
}

function fetchBuffer(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'MoguBot/1.0' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.headers.location) { fetchBuffer(res.headers.location as string).then(resolve); return; }
      const chunks: Buffer[] = []; res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: res.headers['content-type'] ?? 'image/jpeg' }));
    });
    req.on('error', () => resolve(null)); req.setTimeout(12000, () => { req.destroy(); resolve(null); });
  });
}

async function wikiImg(q: string, lang = 'en'): Promise<string | null> {
  try {
    const s = await fetchJson(`https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=5&format=json`);
    for (const title of (s?.[1] ?? [])) {
      const d = await fetchJson(`https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=800`);
      const page: any = Object.values(d?.query?.pages ?? {})[0];
      if (page?.thumbnail?.source) return page.thumbnail.source;
    }
  } catch { /* */ }
  return null;
}

// Hard-coded manual mappings cho những thứ khó tìm
const HARD_MAP: Record<string, string> = {
  // Ingredients
  'chanh hoặc quất': 'lime citrus',
  'đậu phộng rang': 'roasted peanuts',
  'mì quảng tươi': 'yellow noodle flat',
  'nước cốt chanh': 'lime juice',
  'rau ăn kèm hỗn hợp': 'Vietnamese herb plate',
  'thịt ba chỉ': 'pork belly Vietnamese',
  'thịt heo ba chỉ': 'pork belly slice raw',
  'xương bò đùi': 'beef bones broth',
  'xương ống bò': 'beef marrow bone',
  // Dishes
  'bún thịt nướng': 'Vietnamese grilled pork rice noodle bowl bun thit nuong',
  'bánh xèo': 'Vietnamese sizzling crepe banh xeo shrimp pork',
  'bánh cuốn': 'Vietnamese steamed rice roll pork mushroom',
  'bánh canh cua': 'Vietnamese thick noodle crab soup banh canh',
  'gỏi cuốn tôm thịt': 'Vietnamese fresh spring rolls shrimp pork rice paper',
  'phở bò': 'Vietnamese pho beef noodle soup traditional',
};

function getQuery(name: string): { vi: string; en: string } {
  const cleaned = name
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*(miền\s+\w+|hội\s+an|hà\s+nội|miền\s+bắc|miền\s+nam|miền\s+trung)/gi, '')
    .replace(/\s+/g, ' ').trim();
  const lower = cleaned.toLowerCase();

  let en = '';
  for (const [vi, enQ] of Object.entries(HARD_MAP)) {
    if (lower.includes(vi)) { en = enQ; break; }
  }
  if (!en) en = `${cleaned} Vietnamese food`;

  return { vi: cleaned, en };
}

async function searchImg(name: string): Promise<string | null> {
  const { vi, en } = getQuery(name);

  // Try Wikipedia with multiple strategies
  const queries = [vi, en, `${vi} food`, en.split(' ').slice(0, 4).join(' ')];
  for (const q of queries) {
    const url = await wikiImg(q, q === vi ? 'vi' : 'en');
    if (url) { console.log(`  ✓ "${vi}" via "${q}"`); return url; }
    await delay(150);
  }
  console.log(`  ✗ "${name}"`);
  return null;
}

async function uploadToSupabase(imageUrl: string, path: string): Promise<string | null> {
  const res = await fetchBuffer(imageUrl);
  if (!res) return null;
  const { buffer, contentType } = res;
  const mimeType = contentType.split(';')[0].trim();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return null;
  return new Promise((resolve) => {
    const u = new URL(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`);
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': mimeType, 'Content-Length': buffer.length, 'x-upsert': 'true' },
    }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { if ((res.statusCode ?? 0) < 300) resolve(path); else { console.error(`    Upload err ${res.statusCode}`); resolve(null); } });
    });
    req.on('error', () => resolve(null)); req.write(buffer); req.end();
  });
}

async function main() {
  console.log('🔧 Fixing remaining missing images...\n');

  // Ingredients
  const ings: any[] = await p.ingredient.findMany({
    where: { OR: [{ imageUrl: null }, { imageUrl: '' }], isActive: true },
    select: { id: true, name: true }, orderBy: { name: 'asc' },
  });
  console.log(`📦 Ingredients còn thiếu: ${ings.length}`);
  let ingFixed = 0;
  for (let i = 0; i < ings.length; i++) {
    const ing = ings[i];
    process.stdout.write(`[${i+1}/${ings.length}] ${ing.name}... `);
    const url = await searchImg(ing.name);
    if (url) { await p.ingredient.update({ where: { id: ing.id }, data: { imageUrl: url } }); ingFixed++; }
    await delay(300);
  }
  console.log(`\n✅ Ingredients: +${ingFixed}/${ings.length}\n`);

  // Dishes
  const dishesAll: any[] = await p.dish.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, media: { where: { isPrimary: true }, select: { id: true }, take: 1 } },
  });
  const dishes = dishesAll.filter((d: any) => d.media.length === 0);
  console.log(`🍜 Dishes còn thiếu: ${dishes.length}/${dishesAll.length}`);
  let dishFixed = 0;
  for (let i = 0; i < dishes.length; i++) {
    const dish = dishes[i];
    process.stdout.write(`[${i+1}/${dishes.length}] ${dish.name}... `);
    const url = await searchImg(dish.name);
    if (url) {
      const ext = url.includes('.png') ? 'png' : url.includes('.webp') ? 'webp' : 'jpg';
      const key = `dishes/${dish.id}/cover-${Date.now()}.${ext}`;
      const up = await uploadToSupabase(url, key);
      if (up) {
        await p.dishMedia.create({
          data: { dishId: dish.id, type: 'IMAGE', storageKey: up, bucket: STORAGE_BUCKET, mimeType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, sizeBytes: 0, altText: dish.name, credit: 'Wikipedia', sourceUrl: url, isPrimary: true, moderationStatus: 'APPROVED', sortOrder: 0 },
        });
        console.log('  → OK'); dishFixed++;
      }
    }
    await delay(500);
  }

  const finalIngMissing: number = await p.ingredient.count({ where: { OR: [{ imageUrl: null }, { imageUrl: '' }], isActive: true } });
  const totalDishes: number = await p.dish.count({ where: { deletedAt: null } });
  const dishesWithImg: number = await p.dishMedia.count({ where: { isPrimary: true } });

  console.log(`\n=== TỔNG KẾT ===`);
  console.log(`Ingredients: +${ingFixed} | còn thiếu: ${finalIngMissing}`);
  console.log(`Dishes: +${dishFixed} | có ảnh: ${dishesWithImg}/${totalDishes}`);
  console.log('Done!');
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
