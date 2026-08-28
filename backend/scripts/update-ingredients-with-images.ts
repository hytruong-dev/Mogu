/**
 * update-ingredients-with-images.ts
 *
 * Đọc file CSV mới (Ảnh, Tên, Mã, Đơn vị, Dị ứng) và:
 * 1. Update ingredient theo Mã: unit, allergenCode
 * 2. Search ảnh thật qua Unsplash → Wikipedia VI → Wikipedia EN
 * 3. Download ảnh → upload lên Supabase Storage bucket "ingredient-images"
 * 4. Lưu imageUrl + imageKey vào DB
 */
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
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

// ─── CSV parser ───────────────────────────────────────────────────────────────

interface CsvRow {
  imageSearchUrl: string; // Google search URL (dùng để extract tên tiếng Việt)
  name: string;
  code: string;      // ING-0001
  unit: string;      // g, ml, ...
  allergen: string;  // Không / tên dị ứng
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCSV(filePath: string): CsvRow[] {
  const raw = fs.readFileSync(filePath);
  let content: string;
  try {
    content = raw.toString('utf-8');
    if (!content.includes('\u1ed9') && !content.includes('\u1ecd')) throw new Error('not utf8');
  } catch {
    content = raw.toString('latin1');
  }

  const lines = content.split('\n');
  const rows: CsvRow[] = [];
  let headerSkipped = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!headerSkipped) { headerSkipped = true; continue; }

    const parts = parseCSVLine(trimmed);
    if (parts.length < 3) continue;

    const imageSearchUrl = parts[0]?.trim() ?? '';
    const name = parts[1]?.trim() ?? '';
    const code = parts[2]?.trim() ?? '';
    const unit = parts[3]?.trim() ?? 'g';
    const allergen = parts[4]?.trim() ?? '';

    if (code && name) {
      rows.push({ imageSearchUrl, name, code, unit, allergen });
    }
  }
  return rows;
}

// ─── HTTP helper ─────────────────────────────────────────────────────────────

function httpGet(url: string, options: { timeout?: number } = {}): Promise<{ status: number; data: Buffer; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'MoguApp/1.0 (ingredient-image-fetcher)',
        'Accept': 'application/json, image/*, */*',
      },
      timeout: options.timeout ?? 15000,
    }, (res) => {
      // Follow redirects
      if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) && res.headers.location) {
        return httpGet(res.headers.location!, options).then(resolve).catch(reject);
      }
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode ?? 0,
        data: Buffer.concat(chunks),
        headers: res.headers as Record<string, string>,
      }));
      res.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── Image search ─────────────────────────────────────────────────────────────

// Comprehensive VI → EN mapping for ingredients
const VI_TO_EN: Record<string, string> = {
  // Rau lá
  'rau muống': 'water spinach', 'rau cải xanh': 'bok choy', 'cải ngọt': 'sweet cabbage',
  'cải bẹ trắng': 'napa cabbage white', 'cải thìa': 'pak choi', 'cải xoong': 'watercress',
  'cải bó xôi': 'spinach', 'cải kale': 'kale', 'cải xoăn': 'curly kale',
  'cải cúc': 'chrysanthemum greens', 'tần ô': 'chrysanthemum greens', 'cải bẹ dún': 'savoy cabbage',
  'cải mầm': 'sprout cabbage', 'cải làn': 'gai lan', 'cải chíp': 'baby bok choy',
  'bắp cải xanh': 'green cabbage', 'bắp cải tím': 'red cabbage', 'bắp cải thảo': 'napa cabbage',
  'xà lách xoăn': 'frisée lettuce', 'xà lách mỡ': 'butter lettuce', 'xà lách iceberg': 'iceberg lettuce',
  'xà lách romaine': 'romaine lettuce', 'rau mầm': 'microgreens', 'rau dền đỏ': 'red amaranth',
  'rau dền xanh': 'green amaranth', 'rau đay': 'jute leaves', 'rau mồng tơi': 'malabar spinach',
  'rau ngót': 'sauropus leaves', 'rau má': 'pennywort', 'rau sam': 'purslane',
  'rau lang': 'sweet potato leaves', 'rau sắng': 'mung bean leaves', 'rau nhút': 'sensitive plant',
  'rau tần ô': 'chrysanthemum greens', 'rau bina': 'spinach', 'rau tía tô': 'perilla',
  'rau húng quế': 'Thai basil', 'rau húng lủi': 'mint leaves', 'rau ngổ': 'rice paddy herb',
  'rau om': 'rice paddy herb', 'rau thơm': 'herbs', 'hành lá': 'scallion',
  'hành tây': 'onion', 'hành tím': 'shallot', 'tỏi': 'garlic', 'gừng': 'ginger',
  'sả': 'lemongrass', 'nghệ': 'turmeric', 'ớt': 'chili pepper', 'ớt đỏ': 'red chili',
  'ớt xanh': 'green chili', 'ớt hiểm': 'bird eye chili', 'rau ngò': 'cilantro',
  'ngò rí': 'cilantro', 'ngò gai': 'sawtooth herb', 'lá chanh': 'kaffir lime leaves',
  'lá cà ri': 'curry leaves', 'lá lốt': 'lolot leaves', 'lá chuối': 'banana leaf',
  'lá dứa': 'pandan leaf', 'lá nếp': 'pandan leaf', 'lá nguyệt quế': 'bay leaf',
  'lá hẹ': 'garlic chives', 'hẹ': 'garlic chives', 'thì là': 'dill', 'cần tây': 'celery',
  'cần nước': 'water celery', 'bạc hà': 'spearmint', 'diếp cá': 'fish mint',
  'bông cải xanh': 'broccoli', 'bông cải trắng': 'cauliflower', 'bắp non': 'baby corn',
  'bắp chuối': 'banana blossom', 'giá đỗ': 'bean sprouts', 'giá hẹ': 'garlic chive sprouts',
  'mầm đậu nành': 'soybean sprouts', 'măng tây': 'asparagus', 'măng tre': 'bamboo shoots',
  // Củ quả nấm
  'khoai lang': 'sweet potato', 'khoai tây': 'potato', 'khoai môn': 'taro', 'khoai sọ': 'taro',
  'cà rốt': 'carrot', 'củ cải trắng': 'daikon radish', 'củ cải đỏ': 'red radish',
  'củ dền': 'beetroot', 'hành củ': 'onion bulb', 'tỏi củ': 'garlic bulb',
  'gừng củ': 'ginger root', 'nghệ củ': 'turmeric root', 'sắn': 'cassava',
  'ngô': 'corn', 'bắp': 'corn', 'bí đỏ': 'pumpkin', 'bí xanh': 'winter melon',
  'bí ngòi': 'zucchini', 'mướp': 'luffa', 'mướp đắng': 'bitter melon', 'khổ qua': 'bitter melon',
  'su su': 'chayote', 'cà chua': 'tomato', 'cà tím': 'eggplant', 'ớt chuông': 'bell pepper',
  'đậu que': 'green beans', 'đậu đũa': 'yard long beans', 'đậu Hà Lan': 'snow peas',
  'đậu bắp': 'okra', 'nấm rơm': 'straw mushroom', 'nấm đông cô': 'shiitake mushroom',
  'nấm kim châm': 'enoki mushroom', 'nấm mèo': 'wood ear mushroom', 'nấm hương': 'shiitake',
  'nấm bào ngư': 'oyster mushroom', 'nấm linh chi': 'lingzhi mushroom',
  // Trái cây
  'chuối': 'banana', 'xoài': 'mango', 'ổi': 'guava', 'đu đủ': 'papaya',
  'dứa': 'pineapple', 'thanh long': 'dragon fruit', 'chôm chôm': 'rambutan',
  'nhãn': 'longan', 'vải': 'lychee', 'mít': 'jackfruit', 'sầu riêng': 'durian',
  'bơ': 'avocado', 'dâu tây': 'strawberry', 'nho': 'grapes', 'táo': 'apple',
  'lê': 'pear', 'cam': 'orange', 'quýt': 'mandarin', 'bưởi': 'pomelo',
  'chanh': 'lemon', 'chanh dây': 'passion fruit', 'khế': 'starfruit',
  // Thịt
  'thịt heo': 'pork', 'thịt bò': 'beef', 'thịt gà': 'chicken', 'thịt vịt': 'duck',
  'thịt dê': 'goat meat', 'thịt cừu': 'lamb', 'thịt thỏ': 'rabbit meat',
  'sườn heo': 'pork ribs', 'ba chỉ': 'pork belly', 'nạc vai': 'pork shoulder',
  'giò heo': 'pork leg', 'đùi gà': 'chicken thigh', 'ức gà': 'chicken breast',
  'cánh gà': 'chicken wing', 'lòng heo': 'pork intestine', 'gan heo': 'pork liver',
  'trứng gà': 'chicken egg', 'trứng vịt': 'duck egg', 'trứng cút': 'quail egg',
  // Cá hải sản
  'cá trắm': 'grass carp', 'cá chép': 'carp', 'cá rô': 'snakehead fish',
  'cá lóc': 'snakehead fish', 'cá basa': 'basa fish', 'cá tra': 'pangasius',
  'cá ngừ': 'tuna', 'cá thu': 'mackerel', 'cá hồi': 'salmon', 'cá ngần': 'anchovy',
  'tôm': 'shrimp', 'tôm sú': 'tiger prawn', 'tôm he': 'white shrimp',
  'cua': 'crab', 'ghẹ': 'blue crab', 'mực': 'squid', 'bạch tuộc': 'octopus',
  'sò': 'clam', 'hàu': 'oyster', 'nghêu': 'clam', 'ốc': 'snail',
  // Gạo bột đậu
  'gạo tẻ': 'white rice', 'gạo nếp': 'glutinous rice', 'bột mì': 'wheat flour',
  'bột gạo': 'rice flour', 'bột nếp': 'glutinous rice flour', 'bột bắp': 'corn starch',
  'bột năng': 'tapioca starch', 'mì': 'noodle', 'phở': 'pho noodle', 'bún': 'rice vermicelli',
  'miến': 'glass noodle', 'đậu xanh': 'mung bean', 'đậu đen': 'black bean',
  'đậu đỏ': 'red bean', 'đậu nành': 'soybean', 'đậu phộng': 'peanut',
  // Gia vị
  'muối': 'salt', 'đường': 'sugar', 'mắm': 'fish sauce', 'nước mắm': 'fish sauce',
  'tương': 'soy sauce', 'xì dầu': 'soy sauce', 'dầu hào': 'oyster sauce',
  'giấm': 'vinegar', 'tiêu': 'black pepper', 'hồi': 'star anise', 'quế': 'cinnamon',
  'đinh hương': 'clove', 'thảo quả': 'black cardamom', 'sa tế': 'sambal',
  'bột ngọt': 'monosodium glutamate', 'hạt nêm': 'seasoning powder',
  // Nước chấm dầu
  'dầu ăn': 'cooking oil', 'dầu mè': 'sesame oil', 'dầu dừa': 'coconut oil',
  'dầu olive': 'olive oil', 'nước tương': 'soy sauce', 'tương ớt': 'chili sauce',
  'mù tạt': 'mustard', 'mayonnaise': 'mayonnaise',
};

function toEnglishQuery(name: string): string {
  const lower = name.toLowerCase().trim();
  if (VI_TO_EN[lower]) return VI_TO_EN[lower];

  // Partial match
  for (const [vi, en] of Object.entries(VI_TO_EN)) {
    if (lower.includes(vi) || vi.includes(lower)) return en;
  }

  // Fallback: remove diacritics
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd');
}

async function searchUnsplash(name: string): Promise<string | null> {
  if (!UNSPLASH_KEY) return null;
  try {
    const query = encodeURIComponent(toEnglishQuery(name) + ' ingredient food');
    const url = `https://api.unsplash.com/search/photos?query=${query}&per_page=5&orientation=squarish`;
    const res = await httpGet(url);
    if (res.status !== 200) return null;
    const json = JSON.parse(res.data.toString('utf-8'));
    const results = json?.results ?? [];
    if (!results.length) return null;

    // Score results
    const keywords = [toEnglishQuery(name), ...name.toLowerCase().split(' ')];
    let best = results[0];
    let bestScore = 0;
    for (const r of results) {
      const desc = ((r.alt_description ?? '') + ' ' + (r.description ?? '')).toLowerCase();
      let score = keywords.filter(k => desc.includes(k)).length;
      if (score > bestScore) { bestScore = score; best = r; }
    }
    return best.urls?.regular ?? best.urls?.full ?? null;
  } catch { return null; }
}

async function searchWikipediaImage(name: string, lang: 'vi' | 'en' = 'vi'): Promise<string | null> {
  try {
    const query = lang === 'vi' ? name : toEnglishQuery(name);
    const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=3&format=json&origin=*`;
    const searchRes = await httpGet(searchUrl);
    if (searchRes.status !== 200) return null;
    const searchJson = JSON.parse(searchRes.data.toString('utf-8'));
    const hits = searchJson?.query?.search ?? [];
    if (!hits.length) return null;

    const pageTitle = hits[0].title;
    const imageUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=pageimages&pithumbsize=500&format=json&origin=*`;
    const imgRes = await httpGet(imageUrl);
    if (imgRes.status !== 200) return null;
    const imgJson = JSON.parse(imgRes.data.toString('utf-8'));
    const pages = imgJson?.query?.pages ?? {};
    for (const page of Object.values(pages) as any[]) {
      if (page.thumbnail?.source) return page.thumbnail.source;
    }
    return null;
  } catch { return null; }
}

async function findImage(name: string): Promise<string | null> {
  // 1. Unsplash
  const unsplash = await searchUnsplash(name);
  if (unsplash) return unsplash;
  await sleep(200);

  // 2. Wikipedia VI
  const wikiVI = await searchWikipediaImage(name, 'vi');
  if (wikiVI) return wikiVI;

  // 3. Wikipedia EN
  const wikiEN = await searchWikipediaImage(name, 'en');
  if (wikiEN) return wikiEN;

  return null;
}

// ─── Upload to Supabase Storage ───────────────────────────────────────────────

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some(b => b.name === BUCKET);
  if (!exists) {
    await supabase.storage.createBucket(BUCKET, { public: true });
    console.log(`  📦 Tạo bucket "${BUCKET}"`);
  }
}

async function downloadAndUpload(imageUrl: string, code: string): Promise<{ storageUrl: string; storageKey: string } | null> {
  try {
    const res = await httpGet(imageUrl, { timeout: 20000 });
    if (res.status !== 200 || !res.data.length) return null;

    // Detect extension
    const contentType = res.headers['content-type'] ?? 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const storageKey = `${code.toLowerCase()}.${ext}`;

    const { error } = await supabase.storage.from(BUCKET).upload(storageKey, res.data, {
      contentType,
      upsert: true,
    });
    if (error) {
      console.error(`    Upload error: ${error.message}`);
      return null;
    }

    const storageUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storageKey}`;
    return { storageUrl, storageKey };
  } catch (e: any) {
    console.error(`    Download/upload error: ${e.message}`);
    return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const csvPath = `c:/Users/PC/Downloads/1000_nguyen_lieu_link_anh_online (1).csv`;
  console.log('📂 Đọc CSV...');
  const rows = parseCSV(csvPath);
  console.log(`✅ Đọc được ${rows.length} dòng\n`);

  // Ensure bucket exists
  await ensureBucket();

  let updatedMeta = 0, foundImage = 0, uploadedImage = 0, noImage = 0;
  const startTime = Date.now();

  // Build name→id map from DB for fast lookup
  console.log('📋 Tải danh sách nguyên liệu từ DB...');
  const allIngredients = await db.ingredient.findMany({
    select: { id: true, name: true, code: true, imageUrl: true },
  });
  const nameMap = new Map<string, typeof allIngredients[0]>();
  for (const ing of allIngredients) {
    nameMap.set(ing.name.toLowerCase().trim(), ing);
  }
  console.log(`  Loaded ${allIngredients.length} ingredients\n`);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const progress = `[${(i + 1).toString().padStart(4)}/${rows.length}]`;

    // ── 1. Tìm ingredient trong DB theo tên (primary) hoặc code ─────────────
    let existing = nameMap.get(row.name.toLowerCase().trim());
    if (!existing) {
      // Try partial match
      for (const [k, v] of nameMap) {
        if (k === row.name.toLowerCase().trim()) { existing = v; break; }
      }
    }

    if (!existing) {
      process.stdout.write(`${progress} ⚠️  Không tìm thấy: ${row.name}\n`);
      continue;
    }

    // ── Update metadata ──────────────────────────────────────────────────────
    await db.ingredient.update({
      where: { id: existing.id },
      data: {
        code: row.code,           // Cập nhật sang ING-XXXX
        unit: row.unit || 'g',
        allergenCode: row.allergen && row.allergen !== 'Không' ? row.allergen : null,
      },
    });
    updatedMeta++;

    // ── Tìm + upload ảnh nếu chưa có ────────────────────────────────────────
    if (!existing.imageUrl) {
      process.stdout.write(`${progress} 🔍 ${row.name}...`);
      const imgUrl = await findImage(row.name);
      if (imgUrl) {
        foundImage++;
        const uploaded = await downloadAndUpload(imgUrl, row.code);
        if (uploaded) {
          uploadedImage++;
          await db.ingredient.update({
            where: { id: existing.id },
            data: { imageUrl: uploaded.storageUrl, imageKey: uploaded.storageKey },
          });
          process.stdout.write(` ✅ uploaded\n`);
        } else {
          await db.ingredient.update({
            where: { id: existing.id },
            data: { imageUrl: imgUrl },
          });
          process.stdout.write(` ⚡ url saved\n`);
        }
      } else {
        noImage++;
        process.stdout.write(` ✗ no image\n`);
      }
      await sleep(300);
    } else {
      // Đã có ảnh
      if ((i + 1) % 100 === 0) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        console.log(`${progress} ... ${updatedMeta} updated, ${uploadedImage} imgs, ${elapsed}s elapsed`);
      }
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log(`✅ Cập nhật metadata : ${updatedMeta}/${rows.length}`);
  console.log(`🖼️  Tìm được ảnh      : ${foundImage}`);
  console.log(`⬆️  Upload thành công  : ${uploadedImage}`);
  console.log(`✗  Không có ảnh      : ${noImage}`);
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`⏱️  Thời gian          : ${elapsed}s`);

  // Final count
  const withImg = await db.ingredient.count({ where: { imageUrl: { not: null } } });
  const total = await db.ingredient.count();
  console.log(`📊 Có ảnh trong DB    : ${withImg}/${total}`);
}

main().catch(console.error).finally(async () => {
  await db.$disconnect();
  await pool.end();
});
