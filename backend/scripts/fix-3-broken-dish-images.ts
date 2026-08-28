/**
 * Fix 3 DishMedia records có file bị hỏng:
 * - Bánh canh cua miền Nam
 * - Gỏi cuốn tôm thịt
 * - Phở bò Hà Nội
 * → Tìm ảnh mới qua Wikipedia → convert WebP → upload
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

const pool = new (pg.Pool)({ connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter } as any) as any;
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const BUCKET = 'dish-images';
const SUPABASE_URL = process.env.SUPABASE_URL!;

function httpGet(url: string): Promise<{ status: number; data: Buffer }> {
  return new Promise((resolve, reject) => {
    const parsed = new NodeURL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(url, {
      headers: { 'User-Agent': 'MoguBot/1.0', Accept: 'image/*,*/*' },
      timeout: 20000,
    }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode ?? 0) && res.headers.location) {
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

async function searchWikipedia(query: string): Promise<string | null> {
  try {
    // Search VI first
    for (const lang of ['vi', 'en'] as const) {
      const q = encodeURIComponent(query);
      const res = await httpGet(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&srlimit=3&format=json&origin=*`);
      if (res.status !== 200) continue;
      const hits = JSON.parse(res.data.toString())?.query?.search ?? [];
      for (const hit of hits.slice(0, 2)) {
        const imgRes = await httpGet(`https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(hit.title)}&prop=pageimages&pithumbsize=800&format=json&origin=*`);
        if (imgRes.status !== 200) continue;
        const pages = JSON.parse(imgRes.data.toString())?.query?.pages ?? {};
        for (const page of Object.values(pages) as any[]) {
          if (page.thumbnail?.source) return page.thumbnail.source;
        }
      }
    }
  } catch { }
  return null;
}

async function searchUnsplash(query: string): Promise<string | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  try {
    const res = await httpGet(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query + ' food vietnamese')}&per_page=3&client_id=${key}`);
    if (res.status !== 200) return null;
    const results = JSON.parse(res.data.toString())?.results ?? [];
    return results[0]?.urls?.regular ?? null;
  } catch { return null; }
}

// Danh sách 3 món cần fix + query tìm ảnh
const TARGETS = [
  { storageKey: 'dishes/9f3722cf-0df7-4071-9f69-4e3b53b46c42/cover-hc-1787133004717.jpg', dish: 'Bánh canh cua miền Nam', queries: ['bánh canh cua', 'banh canh cua Vietnamese noodle soup crab'] },
  { storageKey: 'dishes/2c74b325-a479-450d-8007-788a47558c23/cover-hc-1787133005447.jpg', dish: 'Gỏi cuốn tôm thịt', queries: ['gỏi cuốn', 'fresh spring rolls Vietnamese goi cuon'] },
  { storageKey: 'dishes/8bba8e66-2d42-452c-9769-f6b6519c7b75/cover-hc-1787133006354.jpg', dish: 'Phở bò Hà Nội', queries: ['phở bò', 'pho bo Vietnamese beef noodle soup'] },
];

async function main() {
  console.log('🔧 Fix 3 broken dish images → WebP\n');

  for (const target of TARGETS) {
    console.log(`🍽  ${target.dish} — ${target.storageKey}`);

    // Find media record in DB
    const media = await db.dishMedia.findFirst({
      where: { storageKey: target.storageKey },
      select: { id: true, dishId: true, storageKey: true },
    });

    if (!media) {
      // Try to find by dishId (may have been updated in previous run)
      console.log('  ⚠ Không tìm thấy record trong DB — tìm theo dish name...');
      const dish = await db.dish.findFirst({
        where: { name: { contains: target.dish.split(' ')[0] } },
        select: { id: true, name: true, media: { select: { id: true, storageKey: true } } },
      });
      if (!dish) { console.log('  ✗ Không tìm thấy dish\n'); continue; }
      console.log(`  Dish: ${dish.name}`);
    }

    // Search for image
    let imgUrl: string | null = null;
    for (const q of target.queries) {
      imgUrl = await searchWikipedia(q);
      if (imgUrl) { console.log(`  🔍 Wikipedia: ${imgUrl.slice(0, 60)}...`); break; }
    }
    if (!imgUrl) {
      for (const q of target.queries) {
        imgUrl = await searchUnsplash(q);
        if (imgUrl) { console.log(`  🔍 Unsplash: ${imgUrl.slice(0, 60)}...`); break; }
      }
    }

    if (!imgUrl) { console.log('  ✗ Không tìm được ảnh\n'); continue; }

    // Download
    const res = await httpGet(imgUrl);
    if (res.status !== 200 || res.data.length < 500) { console.log('  ✗ Download thất bại\n'); continue; }

    // Convert to WebP
    let webpBuf: Buffer;
    try {
      webpBuf = await sharp(res.data).webp({ quality: 85 }).resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).toBuffer();
    } catch (e: any) { console.log(`  ✗ Convert lỗi: ${e.message}\n`); continue; }

    // New key: same path but .webp
    const newKey = target.storageKey.replace(/\.[^.]+$/, '.webp');

    // Upload
    const { error } = await supabase.storage.from(BUCKET).upload(newKey, webpBuf, {
      contentType: 'image/webp', upsert: true,
    });
    if (error) { console.log(`  ✗ Upload lỗi: ${error.message}\n`); continue; }

    // Delete old broken file
    await supabase.storage.from(BUCKET).remove([target.storageKey]);

    // Update DB if found
    if (media) {
      await db.dishMedia.update({
        where: { id: media.id },
        data: { storageKey: newKey, mimeType: 'image/webp', sizeBytes: webpBuf.length },
      });
    } else {
      // Find by dish name
      const dish = await db.dish.findFirst({
        where: { name: { contains: target.dish.split(' ')[0] } },
        include: { media: { where: { storageKey: target.storageKey } } },
      });
      if (dish?.media?.[0]) {
        await db.dishMedia.update({
          where: { id: dish.media[0].id },
          data: { storageKey: newKey, mimeType: 'image/webp', sizeBytes: webpBuf.length },
        });
      }
    }

    const newUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${newKey}`;
    console.log(`  ✅ ${newKey} (${(webpBuf.length / 1024).toFixed(1)}KB)`);
    console.log(`  URL: ${newUrl}\n`);
  }

  console.log('✅ Xong!');
}

main().catch(console.error).finally(async () => {
  await db.$disconnect();
  await pool.end();
});
