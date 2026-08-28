/**
 * fix-imgs-unsplash-only.ts
 * Dùng Unsplash để tìm ảnh cho các nguyên liệu chưa có ảnh
 * Rate limit: 50 req/giờ → chạy 45 items/batch, sleep 61 phút giữa các batch
 * 
 * Usage: npx tsx scripts/fix-imgs-unsplash-only.ts [--offset N] [--limit N]
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

const pool = new (pg.Pool)({ connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter } as any) as any;
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY!;
const BUCKET = 'ingredient-images';
const SUPABASE_URL = process.env.SUPABASE_URL!;

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
  'rau lang': 'sweet potato leaves', 'rau tía tô': 'perilla',
  'rau kinh giới': 'elsholtzia herb', 'rau húng quế': 'Thai basil',
  'rau húng lủi': 'spearmint', 'rau răm': 'Vietnamese coriander',
  'rau ngổ': 'rice paddy herb', 'rau mùi': 'cilantro',
  'ngò rí': 'cilantro', 'ngò gai': 'sawtooth herb', 'hành lá': 'scallion green onion',
  'hành boa rô': 'leek', 'lá lốt': 'lolot leaf betel', 'lá chanh': 'kaffir lime leaf',
  'lá cà ri': 'curry leaf', 'lá dứa': 'pandan leaf', 'lá nếp': 'pandan leaf',
  'lá nguyệt quế': 'bay leaf', 'hẹ': 'garlic chives', 'thì là': 'dill',
  'cần tây': 'celery', 'bạc hà': 'mint', 'diếp cá': 'fish mint houttuynia',
  'bông cải xanh': 'broccoli', 'bông cải trắng': 'cauliflower', 'bắp non': 'baby corn',
  'bắp chuối': 'banana blossom', 'bông bí': 'zucchini flower', 'bông điên điển': 'sesbania flower',
  'bông súng': 'water lily', 'bông hẹ': 'chive flower', 'hoa chuối': 'banana blossom',
  'giá đỗ': 'bean sprouts', 'măng tây': 'asparagus', 'măng tre': 'bamboo shoots',
  'khoai lang': 'sweet potato', 'khoai tây': 'potato', 'khoai môn': 'taro',
  'khoai sọ': 'taro', 'khoai mì': 'cassava', 'cà rốt': 'carrot',
  'củ cải trắng': 'daikon radish', 'củ cải đỏ': 'red radish', 'củ dền': 'beetroot',
  'hành tây': 'onion', 'hành tím': 'shallot', 'tỏi': 'garlic', 'gừng': 'ginger',
  'nghệ': 'turmeric', 'sả': 'lemongrass', 'riềng': 'galangal', 'ngô': 'corn',
  'bí đỏ': 'pumpkin', 'bí xanh': 'winter melon', 'bí ngòi': 'zucchini',
  'mướp': 'luffa', 'mướp đắng': 'bitter melon', 'khổ qua': 'bitter melon',
  'su su': 'chayote', 'cà chua': 'tomato', 'cà tím': 'eggplant',
  'ớt chuông': 'bell pepper', 'đậu que': 'green beans', 'đậu đũa': 'yard long beans',
  'đậu bắp': 'okra', 'nấm rơm': 'straw mushroom', 'nấm đông cô': 'shiitake',
  'nấm kim châm': 'enoki mushroom', 'nấm mèo': 'wood ear mushroom',
  'nấm bào ngư': 'oyster mushroom', 'nấm linh chi': 'reishi mushroom',
  'chuối': 'banana', 'xoài': 'mango', 'ổi': 'guava', 'đu đủ': 'papaya',
  'dứa': 'pineapple', 'thanh long': 'dragon fruit', 'chôm chôm': 'rambutan',
  'nhãn': 'longan', 'vải': 'lychee', 'mít': 'jackfruit', 'sầu riêng': 'durian',
  'bơ': 'avocado', 'dâu tây': 'strawberry', 'nho': 'grapes', 'táo': 'apple',
  'lê': 'pear', 'cam': 'orange', 'quýt': 'tangerine', 'bưởi': 'pomelo',
  'chanh': 'lemon', 'chanh dây': 'passion fruit', 'khế': 'starfruit',
  'me': 'tamarind', 'mận': 'plum', 'đào': 'peach', 'vú sữa': 'star apple',
  'mãng cầu': 'custard apple', 'na': 'custard apple',
  'thịt heo': 'pork', 'thịt bò': 'beef', 'thịt gà': 'chicken',
  'thịt vịt': 'duck', 'thịt dê': 'goat meat', 'thịt cừu': 'lamb',
  'sườn heo': 'pork ribs', 'ba chỉ': 'pork belly', 'chân giò': 'pork knuckle',
  'đùi gà': 'chicken thigh', 'ức gà': 'chicken breast', 'cánh gà': 'chicken wing',
  'gan heo': 'pork liver', 'trứng gà': 'chicken egg', 'trứng vịt': 'duck egg',
  'trứng cút': 'quail egg', 'pate gan': 'pate liver',
  'cá trắm': 'grass carp', 'cá chép': 'carp fish', 'cá lóc': 'snakehead fish',
  'cá basa': 'basa fish', 'cá ngừ': 'tuna', 'cá thu': 'mackerel', 'cá hồi': 'salmon',
  'cá cơm': 'anchovy', 'tôm': 'shrimp', 'tôm sú': 'tiger prawn', 'cua': 'crab',
  'ghẹ': 'blue crab', 'mực': 'squid', 'bạch tuộc': 'octopus', 'hàu': 'oyster',
  'nghêu': 'clam', 'ốc': 'snail', 'tôm khô': 'dried shrimp', 'cá khô': 'dried fish',
  'gạo tẻ': 'white rice', 'gạo nếp': 'glutinous rice', 'bột mì': 'wheat flour',
  'bột gạo': 'rice flour', 'bột năng': 'tapioca starch', 'bột bắp': 'corn starch',
  'mì': 'noodle', 'phở': 'rice noodle', 'bún': 'rice vermicelli',
  'miến': 'glass noodle', 'đậu xanh': 'mung bean', 'đậu đen': 'black bean',
  'đậu đỏ': 'red kidney bean', 'đậu nành': 'soybean', 'đậu phộng': 'peanut',
  'hạt sen': 'lotus seed', 'muối': 'salt', 'đường': 'sugar', 'nước mắm': 'fish sauce',
  'xì dầu': 'soy sauce', 'dầu hào': 'oyster sauce', 'giấm': 'vinegar',
  'tiêu': 'black pepper', 'hồi': 'star anise', 'quế': 'cinnamon',
  'đinh hương': 'clove', 'thảo quả': 'black cardamom', 'bột ngọt': 'MSG',
  'ớt': 'chili pepper', 'mè': 'sesame', 'vừng': 'sesame seeds',
  'dầu ăn': 'cooking oil', 'dầu mè': 'sesame oil', 'dầu dừa': 'coconut oil',
  'dầu olive': 'olive oil', 'tương ớt': 'chili sauce', 'mayonnaise': 'mayonnaise',
  'sữa dừa': 'coconut milk', 'nước dừa': 'coconut water',
  'mắm tôm': 'shrimp paste', 'mắm ruốc': 'shrimp paste',
  'nấm hương': 'shiitake mushroom', 'hành khô': 'dried shallot',
  'tỏi khô': 'dried garlic', 'ớt khô': 'dried chili', 'nghệ bột': 'turmeric powder',
  'gừng bột': 'ginger powder', 'bột cà ri': 'curry powder', 'bột ớt': 'chili powder',
  'rượu trắng': 'rice wine', 'rượu nếp': 'glutinous rice wine',
  'sữa tươi': 'fresh milk', 'sữa đặc': 'condensed milk', 'kem tươi': 'heavy cream',
  'bơ lạt': 'unsalted butter', 'phô mai': 'cheese', 'sữa chua': 'yogurt',
  'đậu hũ': 'tofu', 'tàu hũ': 'tofu', 'đậu phụ': 'tofu',
  'sa tế': 'sambal', 'tương hoisin': 'hoisin sauce', 'sốt cà chua': 'tomato sauce',
  'yến mạch': 'oat', 'lúa mì': 'wheat', 'hạt chia': 'chia seeds',
  'hạt điều': 'cashew', 'hạt óc chó': 'walnut', 'hạnh nhân': 'almond',
};

function toEn(name: string): string {
  const lower = name.toLowerCase().trim();
  if (VI_EN[lower]) return VI_EN[lower];
  for (const [vi, en] of Object.entries(VI_EN)) {
    if (lower.includes(vi)) return en;
  }
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd');
}

function httpGet(url: string): Promise<{ status: number; data: Buffer }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'MoguBot/1.0', Accept: 'application/json, image/*' }, timeout: 15000 }, (res) => {
      if ([301, 302, 307].includes(res.statusCode ?? 0) && res.headers.location) {
        return httpGet(res.headers.location!).then(resolve).catch(reject);
      }
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, data: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function searchUnsplash(name: string): Promise<string | null> {
  try {
    const en = toEn(name);
    const q = encodeURIComponent(en + ' food ingredient cooking');
    const res = await httpGet(`https://api.unsplash.com/search/photos?query=${q}&per_page=5&orientation=squarish&client_id=${UNSPLASH_KEY}`);
    if (res.status === 403) { console.log('\n⚠️  Unsplash 403 — rate limited!'); return null; }
    if (res.status !== 200) return null;
    const results = JSON.parse(res.data.toString())?.results ?? [];
    if (!results.length) return null;
    const enLower = en.toLowerCase().split(' ');
    let best = results[0]; let bestScore = -1;
    for (const r of results) {
      const desc = ((r.alt_description ?? '') + ' ' + (r.description ?? '')).toLowerCase();
      const score = enLower.filter(k => k.length > 3 && desc.includes(k)).length;
      if (score > bestScore) { bestScore = score; best = r; }
    }
    return best.urls?.regular ?? null;
  } catch { return null; }
}

async function downloadAndUpload(imgUrl: string, code: string): Promise<{ url: string; key: string } | null> {
  try {
    const res = await httpGet(imgUrl);
    if (res.status !== 200 || !res.data.length) return null;
    const key = `${code.toLowerCase().replace(/[^a-z0-9-]/g, '-')}.jpg`;
    const { error } = await supabase.storage.from(BUCKET).upload(key, res.data, { contentType: 'image/jpeg', upsert: true });
    if (error) return null;
    return { url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${key}`, key };
  } catch { return null; }
}

async function main() {
  // Parse args
  const args = process.argv.slice(2);
  const offsetArg = args.indexOf('--offset');
  const limitArg = args.indexOf('--limit');
  const OFFSET = offsetArg >= 0 ? parseInt(args[offsetArg + 1]) : 0;
  const LIMIT = limitArg >= 0 ? parseInt(args[limitArg + 1]) : 45;
  const BATCH_SIZE = 45;

  const items = await db.ingredient.findMany({
    where: { imageUrl: null },
    select: { id: true, name: true, code: true },
    orderBy: { code: 'asc' },
    skip: OFFSET,
    take: LIMIT,
  });

  console.log(`🔍 Xử lý ${items.length} nguyên liệu (offset=${OFFSET}, limit=${LIMIT})\n`);

  let found = 0, uploaded = 0, noImg = 0, rateLimited = false;

  for (let i = 0; i < items.length; i++) {
    if (rateLimited) { console.log('\n⏸️  Rate limited — dừng batch này'); break; }

    const item = items[i];
    const prog = `[${(OFFSET + i + 1).toString().padStart(4)}]`;
    process.stdout.write(`${prog} ${item.name}...`);

    const imgUrl = await searchUnsplash(item.name);
    if (!imgUrl) {
      if (imgUrl === null) { /* check if it was rate limited */ }
      noImg++;
      process.stdout.write(` ✗\n`);
      await sleep(1500); // 1.5s between requests → max 40/min → safe
      continue;
    }

    found++;
    const up = await downloadAndUpload(imgUrl, item.code);
    if (up) {
      uploaded++;
      await db.ingredient.update({ where: { id: item.id }, data: { imageUrl: up.url, imageKey: up.key } });
      process.stdout.write(` ✅\n`);
    } else {
      await db.ingredient.update({ where: { id: item.id }, data: { imageUrl: imgUrl } });
      process.stdout.write(` ⚡ url\n`);
    }
    await sleep(1500);
  }

  console.log(`\n✅ Tìm được: ${found} | Upload: ${uploaded} | Không có: ${noImg}`);
  const withImg = await db.ingredient.count({ where: { imageUrl: { not: null } } });
  const total = await db.ingredient.count();
  console.log(`📊 DB: ${withImg}/${total} có ảnh`);
  console.log(`\n💡 Còn ${total - withImg} nguyên liệu chưa có ảnh`);
  console.log(`   Chạy tiếp: npx tsx scripts/fix-imgs-unsplash-only.ts --offset ${OFFSET + LIMIT} --limit 45`);
}

main().catch(console.error).finally(async () => { await db.$disconnect(); await pool.end(); });
