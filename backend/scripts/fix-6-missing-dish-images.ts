/**
 * Tìm và upload ảnh cho 6 món thiếu hình:
 * - Gà kho gừng
 * - Bún thịt nướng Miền Trung
 * - Bánh cuốn miền Bắc
 * - Cá kho tộ (kiểu Miền Nam)
 * - Bánh xèo miền Trung
 * - Cao lầu Hội An
 */
import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';
import * as https from 'https';
import * as http from 'http';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY ?? '';
const SUPABASE_URL = process.env.SUPABASE_URL!;

const DISHES = [
  { name: 'Gà kho gừng',                en: 'Vietnamese ginger braised chicken',  wiki: 'Gà kho gừng' },
  { name: 'Bún thịt nướng Miền Trung',  en: 'Vietnamese grilled pork noodle bowl', wiki: 'Bún thịt nướng' },
  { name: 'Bánh cuốn miền Bắc',         en: 'Vietnamese steamed rice roll banh cuon', wiki: 'Bánh cuốn' },
  { name: 'Cá kho tộ (kiểu Miền Nam)',  en: 'Vietnamese caramelized fish clay pot', wiki: 'Cá kho tộ' },
  { name: 'Bánh xèo miền Trung',        en: 'Vietnamese sizzling crepe banh xeo', wiki: 'Bánh xèo' },
  { name: 'Cao lầu Hội An',             en: 'Hoi An cao lau noodle dish', wiki: 'Cao lầu' },
];

function fetch(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'MoguApp/1.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetch(res.headers.location!).then(resolve).catch(reject);
      }
      const chunks: Buffer[] = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function searchUnsplash(query: string): Promise<string | null> {
  if (!UNSPLASH_KEY) return null;
  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`;
    const buf = await fetch(url + `&client_id=${UNSPLASH_KEY}`);
    const data = JSON.parse(buf.toString());
    if (data.results?.length > 0) {
      return data.results[0].urls.regular;
    }
  } catch (e) { /* noop */ }
  return null;
}

async function searchWikipedia(title: string): Promise<string | null> {
  // Try VI wiki first
  for (const lang of ['vi', 'en']) {
    try {
      const encodedTitle = encodeURIComponent(title);
      const apiUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`;
      const buf = await fetch(apiUrl);
      const data = JSON.parse(buf.toString());
      if (data.thumbnail?.source) {
        // Get higher res version
        const src = data.thumbnail.source.replace(/\/\d+px-/, '/500px-');
        return src;
      }
    } catch { /* noop */ }
  }
  return null;
}

async function uploadToSupabase(dishId: string, dishName: string, imgBuf: Buffer, mimeType = 'image/jpeg'): Promise<string | null> {
  const ext = mimeType.includes('webp') ? 'webp' : mimeType.includes('png') ? 'png' : 'jpg';
  const storageKey = `dishes/${dishId}/cover-fix-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('dish-images').upload(storageKey, imgBuf, {
    contentType: mimeType,
    upsert: true,
  });
  if (error) { console.error('Upload error:', error.message); return null; }
  return storageKey;
}

async function main() {
  let fixed = 0;
  for (const dish of DISHES) {
    console.log(`\n🔍 ${dish.name}`);

    // Get dish ID
    const dr = await pool.query(`SELECT id FROM dishes WHERE name = $1 AND deleted_at IS NULL LIMIT 1`, [dish.name]);
    if (!dr.rows.length) { console.log('  ❌ Dish not found in DB'); continue; }
    const dishId = dr.rows[0].id;

    // Check if already has media
    const mr = await pool.query(`SELECT id FROM dish_media WHERE dish_id = $1 LIMIT 1`, [dishId]);
    if (mr.rows.length > 0) { console.log('  ✅ Already has media, skipping'); continue; }

    // Search image
    let imgUrl: string | null = null;
    let source = '';

    imgUrl = await searchUnsplash(dish.en);
    if (imgUrl) { source = 'Unsplash'; }

    if (!imgUrl) {
      imgUrl = await searchWikipedia(dish.wiki);
      if (imgUrl) source = 'Wikipedia VI';
    }
    if (!imgUrl) {
      imgUrl = await searchWikipedia(dish.en.split(' ').slice(0, 3).join(' '));
      if (imgUrl) source = 'Wikipedia EN';
    }

    if (!imgUrl) { console.log('  ❌ No image found'); continue; }
    console.log(`  📸 Found via ${source}: ${imgUrl.substring(0, 70)}...`);

    // Download
    let imgBuf: Buffer;
    try { imgBuf = await fetch(imgUrl); } catch (e: any) { console.log('  ❌ Download failed:', e.message); continue; }

    // Detect mime type from URL
    const mimeType = imgUrl.includes('.png') ? 'image/png' : imgUrl.includes('.webp') ? 'image/webp' : 'image/jpeg';

    // Upload to Supabase
    const storageKey = await uploadToSupabase(dishId, dish.name, imgBuf, mimeType);
    if (!storageKey) continue;

    // Save to dish_media
    await pool.query(`
      INSERT INTO dish_media (id, dish_id, type, storage_key, bucket, mime_type, size_bytes, alt_text, credit, source_url, moderation_status, is_primary, sort_order)
      VALUES (gen_random_uuid(), $1, 'IMAGE', $2, 'dish-images', $3, $4, $5, $6, $7, 'APPROVED', true, 0)
    `, [dishId, storageKey, mimeType, imgBuf.length, dish.name, source, imgUrl]);

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/dish-images/${storageKey}`;
    console.log(`  ✅ Saved: ${publicUrl.substring(0, 80)}...`);

    // Update image_url_snapshot for existing slots
    const updated = await pool.query(`
      UPDATE weekly_plan_slots 
      SET image_url_snapshot = $1
      WHERE dish_id = $2 AND image_url_snapshot IS NULL
    `, [publicUrl, dishId]);
    console.log(`  🔄 Updated ${updated.rowCount} slots`);

    fixed++;
  }

  console.log(`\n✅ Fixed ${fixed}/${DISHES.length} dishes`);
  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
