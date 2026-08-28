/**
 * link-unlinked-dish-ingredients.ts
 *
 * Script này tìm tất cả DishIngredient records không có ingredientId,
 * parse rawText để lấy tên nguyên liệu, fuzzy match với Ingredient table,
 * và link hoặc tạo mới Ingredient record.
 *
 * Sau đó tìm ảnh cho Ingredient mới tạo.
 */

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);
const p = (prisma as any).$extends({}) as any;
const db = (prisma as any).db ?? prisma;

// ── Supabase Storage ────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

async function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'MoguBot/1.0 (contact@mogu.app)',
        'Accept-Language': 'vi,en;q=0.9',
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`JSON parse error for ${url}: ${data.substring(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function fetchBuffer(url: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: { 'User-Agent': 'MoguBot/1.0' },
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location!;
        fetchBuffer(loc).then(resolve);
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', () => resolve(null));
    req.setTimeout(15000, () => { req.destroy(); resolve(null); });
  });
}

async function uploadToSupabase(imgBuffer: Buffer, ingredientId: string, mimeType = 'image/jpeg'): Promise<string | null> {
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const storagePath = `${ingredientId}/cover.${ext}`;
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/ingredient-images/${storagePath}`;

  return new Promise((resolve) => {
    const urlObj = new URL(uploadUrl);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': mimeType,
        'Content-Length': imgBuffer.length,
        'x-upsert': 'true',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve(`${SUPABASE_URL}/storage/v1/object/public/ingredient-images/${storagePath}`);
        } else {
          console.error(`Upload failed ${res.statusCode}: ${data}`);
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.write(imgBuffer);
    req.end();
  });
}

// ── Image search ────────────────────────────────────────────────────────────
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;

async function searchUnsplash(query: string): Promise<string | null> {
  if (!UNSPLASH_KEY) return null;
  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=squarish`;
    const data = await fetchJson(url + `&client_id=${UNSPLASH_KEY}`);
    if (!data.results?.length) return null;
    // Score by relevance
    const keywords = query.toLowerCase().split(/\s+/);
    let best = data.results[0];
    let bestScore = 0;
    for (const r of data.results) {
      const desc = `${r.alt_description ?? ''} ${r.description ?? ''}`.toLowerCase();
      const score = keywords.filter((k: string) => desc.includes(k)).length;
      if (score > bestScore) { bestScore = score; best = r; }
    }
    return best.urls.regular;
  } catch { return null; }
}

async function searchWikipedia(name: string, lang: 'vi' | 'en' = 'vi'): Promise<string | null> {
  try {
    // Tìm trang Wikipedia
    const searchUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
    const data = await fetchJson(searchUrl);
    if (data.thumbnail?.source) return data.thumbnail.source;
    return null;
  } catch { return null; }
}

// Vietnamese to English mapping cho nguyên liệu
const VI_TO_EN: Record<string, string> = {
  'thịt gà đùi': 'chicken thigh meat raw',
  'gừng tươi': 'fresh ginger root',
  'hành tím': 'shallot onion',
  'tỏi': 'garlic cloves fresh',
  'ớt tươi': 'fresh chili pepper red',
  'hành lá': 'green onion spring onion',
  'tiêu đen xay': 'black pepper ground',
  'muối': 'sea salt',
  'đường vàng': 'brown sugar',
  'nước mắm': 'Vietnamese fish sauce bottle',
  'nước tương': 'soy sauce dark',
  'dầu ăn': 'cooking oil vegetable',
  'nước lọc': 'clean water glass',
  // Cao lầu
  'mì cao lầu': 'cao lau noodles Hoi An',
  'thịt heo quay': 'Vietnamese roasted pork',
  'tép mỡ': 'Vietnamese fried lard crouton',
  'rau sống': 'Vietnamese fresh herb salad',
  'giá đỗ': 'bean sprout fresh',
  'xà lách': 'lettuce fresh green',
  'húng quế': 'fresh basil Vietnamese',
  'ngò rí': 'cilantro fresh herb',
  'rau muống': 'morning glory water spinach',
  'cải xanh': 'Chinese mustard greens vegetable',
  'nước tro tàu': 'lye water alkaline',
  'nước cốt tương': 'hoisin sauce bottle',
  'tương hoisin': 'hoisin sauce bottle',
  // Cá kho tộ
  'cá basa': 'basa catfish fillet',
  'cá thu': 'mackerel fish fresh',
  'cá lóc': 'snakehead fish Vietnamese',
  'nước dừa': 'coconut water fresh',
  'dừa nước': 'coconut water fresh',
  'caramel': 'caramel sauce dark',
  'tiêu đen': 'black pepper whole',
  'ớt đỏ': 'red chili pepper fresh',
  'nghệ': 'turmeric powder spice',
  'nước màu': 'Vietnamese caramel sauce color',
  'hành khô': 'dried shallot fried',
  // generic
  'đường': 'sugar granulated white',
  'nước mắm ngon': 'Vietnamese fish sauce bottle premium',
  'tiêu': 'black pepper',
  'ớt': 'chili pepper fresh',
  'hành': 'onion fresh',
  'gừng': 'ginger root fresh',
  'tỏi khô': 'dried garlic clove',
  'mỡ heo': 'pork lard fat',
  'thịt ba chỉ': 'pork belly Vietnamese',
  'thịt heo': 'pork meat fresh',
  'trứng vịt': 'duck egg Vietnamese',
  'trứng gà': 'chicken egg fresh',
};

function toEnglishQuery(viName: string): string {
  const clean = viName.toLowerCase()
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Direct mapping
  for (const [vi, en] of Object.entries(VI_TO_EN)) {
    if (clean.includes(vi)) return en;
  }
  // Fallback: remove diacritics
  return clean
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

async function findImage(name: string): Promise<string | null> {
  // 1. Unsplash với English query
  const enQuery = toEnglishQuery(name);
  const unsplashUrl = await searchUnsplash(enQuery + ' food ingredient');
  if (unsplashUrl) {
    console.log(`  📸 Unsplash: ${name} → ${enQuery}`);
    return unsplashUrl;
  }

  // 2. Wikipedia VI
  const wikiVI = await searchWikipedia(name, 'vi');
  if (wikiVI) {
    console.log(`  📖 Wiki VI: ${name}`);
    return wikiVI;
  }

  // 3. Wikipedia EN
  const wikiEN = await searchWikipedia(enQuery, 'en');
  if (wikiEN) {
    console.log(`  📖 Wiki EN: ${enQuery}`);
    return wikiEN;
  }

  return null;
}

// ── Parse rawText to extract ingredient name ─────────────────────────────────
function parseIngredientName(rawText: string): string {
  // rawText format: "600 g Thịt gà đùi hoặc má đùi (Rửa sạch, thấm khô...)"
  // Remove leading quantity + unit
  let text = rawText.trim();
  // Remove parenthetical description
  text = text.replace(/\s*\([^)]*\)/g, '').trim();
  // Remove quantity + unit at start: "600 g " or "2 lon "
  text = text.replace(/^\d+(\.\d+)?\s*(g|kg|ml|l|lon|củ|quả|tép|nhánh|cái|muỗng|viên|vắt|lá)\s+/i, '').trim();
  // Remove extra info after common separators
  text = text.replace(/\s+(hoặc|hoac|hay)\s+.*/i, '').trim();
  return text;
}

// ── Fuzzy match ingredient name ───────────────────────────────────────────────
function normalize(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  // Word overlap
  const wa = new Set(na.split(/\s+/));
  const wb = new Set(nb.split(/\s+/));
  const inter = [...wa].filter(w => wb.has(w)).length;
  const union = new Set([...wa, ...wb]).size;
  return inter / union;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔍 Tìm tất cả DishIngredients chưa được link...\n');

  // Load all existing Ingredient records
  const allIngredients = await (db as any).ingredient.findMany({
    where: { isActive: true },
    select: { id: true, name: true, imageUrl: true, code: true },
  });
  console.log(`📦 Loaded ${allIngredients.length} Ingredient records from DB\n`);

  // Find all DishIngredients without ingredientId
  const unlinked = await (db as any).dishIngredient.findMany({
    where: { ingredientId: null },
    select: { id: true, rawText: true, dishId: true },
  });
  console.log(`🔗 Found ${unlinked.length} unlinked DishIngredients\n`);

  if (unlinked.length === 0) {
    console.log('✅ Không có DishIngredients nào cần link!');
    return;
  }

  let linked = 0;
  let created = 0;
  let notFound = 0;
  const newIngredients: Array<{ id: string; name: string }> = [];

  for (const di of unlinked) {
    const parsedName = parseIngredientName(di.rawText);
    console.log(`\n[${di.id.substring(0, 8)}] rawText: "${di.rawText.substring(0, 60)}"`);
    console.log(`  → parsed name: "${parsedName}"`);

    // Find best match
    let bestMatch: { id: string; name: string; imageUrl: string | null } | null = null;
    let bestScore = 0;

    for (const ing of allIngredients) {
      const score = similarity(parsedName, ing.name);
      if (score > bestScore && score >= 0.65) {
        bestScore = score;
        bestMatch = ing;
      }
    }

    if (bestMatch && bestScore >= 0.65) {
      console.log(`  ✅ Match: "${bestMatch.name}" (score: ${bestScore.toFixed(2)})`);
      await (db as any).dishIngredient.update({
        where: { id: di.id },
        data: { ingredientId: bestMatch.id },
      });
      linked++;
    } else {
      // Create new Ingredient
      console.log(`  ➕ Creating new Ingredient: "${parsedName}"`);
      const code = normalize(parsedName)
        .replace(/\s+/g, '-')
        .substring(0, 85) + '-' + Date.now().toString().slice(-5);
      
      try {
        const newIng = await (db as any).ingredient.create({
          data: {
            name: parsedName.substring(0, 198),
            code,
            unit: null,
            imageUrl: null,
            isActive: true,
          },
        });
        // Link
        await (db as any).dishIngredient.update({
          where: { id: di.id },
          data: { ingredientId: newIng.id },
        });
        allIngredients.push({ id: newIng.id, name: parsedName, imageUrl: null, code });
        newIngredients.push({ id: newIng.id, name: parsedName });
        created++;
        linked++;
      } catch (e: any) {
        console.error(`  ❌ Failed to create: ${e.message}`);
        notFound++;
      }
    }
  }

  console.log(`\n📊 Results:`);
  console.log(`  ✅ Linked: ${linked}`);
  console.log(`  ➕ Created: ${created}`);
  console.log(`  ❌ Failed: ${notFound}`);

  // Find images for new ingredients
  if (newIngredients.length > 0) {
    console.log(`\n🔍 Tìm ảnh cho ${newIngredients.length} nguyên liệu mới...`);
    
    for (const ing of newIngredients) {
      console.log(`\n[${ing.id.substring(0, 8)}] "${ing.name}"`);
      const imageUrl = await findImage(ing.name);
      
      if (imageUrl) {
        // Nếu là URL external (Unsplash), download và upload lên Supabase
        if (imageUrl.startsWith('http') && !imageUrl.includes('supabase')) {
          const imgBuf = await fetchBuffer(imageUrl);
          if (imgBuf) {
            const supaUrl = await uploadToSupabase(imgBuf, ing.id);
            if (supaUrl) {
              await (db as any).ingredient.update({
                where: { id: ing.id },
                data: { imageUrl: supaUrl },
              });
              console.log(`  ✅ Uploaded to Supabase`);
            } else {
              // fallback: store external URL directly
              await (db as any).ingredient.update({
                where: { id: ing.id },
                data: { imageUrl },
              });
              console.log(`  ⚠️ Stored external URL (upload failed)`);
            }
          }
        } else {
          await (db as any).ingredient.update({
            where: { id: ing.id },
            data: { imageUrl },
          });
          console.log(`  ✅ Stored URL`);
        }
      } else {
        console.log(`  ❌ Không tìm được ảnh`);
      }
      
      await new Promise(r => setTimeout(r, 500)); // rate limit
    }
  }

  console.log(`\n✅ Done!`);
  await (db as any).$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
