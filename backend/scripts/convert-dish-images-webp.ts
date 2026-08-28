/**
 * convert-dish-images-webp.ts
 * Download tất cả ảnh dish từ Supabase Storage → convert WebP → upload lại
 * Cập nhật storageKey + imageUrl trong DishMedia
 */
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { URL as NodeURL } from 'url';
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

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

function httpGet(url: string): Promise<{ status: number; data: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new NodeURL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(url, {
      headers: { 'User-Agent': 'MoguBot/1.0', Accept: 'image/*' },
      timeout: 20000,
    }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode ?? 0) && res.headers.location) {
        return httpGet(res.headers.location!).then(resolve).catch(reject);
      }
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode ?? 0,
        data: Buffer.concat(chunks),
        contentType: (res.headers['content-type'] ?? 'image/jpeg').split(';')[0].trim(),
      }));
      res.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
}

async function toWebP(buf: Buffer): Promise<Buffer> {
  return sharp(buf)
    .webp({ quality: 85, effort: 4 })
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .toBuffer();
}

async function main() {
  console.log('🍽️  Convert dish-images → WebP\n');

  // Load tất cả DishMedia records
  const mediaList = await db.dishMedia.findMany({
    select: {
      id: true,
      storageKey: true,
      bucket: true,
      mimeType: true,
      sizeBytes: true,
      dish: { select: { id: true, name: true } },
    },
  });

  console.log(`📋 Tổng DishMedia: ${mediaList.length}`);
  const toConvert = mediaList.filter((m: any) => m.storageKey && !m.storageKey.endsWith('.webp'));
  const alreadyWebp = mediaList.filter((m: any) => m.storageKey?.endsWith('.webp'));
  const noKey = mediaList.filter((m: any) => !m.storageKey);

  console.log(`   Cần convert : ${toConvert.length}`);
  console.log(`   Đã là WebP  : ${alreadyWebp.length} (bỏ qua)`);
  console.log(`   Không có key: ${noKey.length}`);
  console.log();

  if (!toConvert.length) {
    console.log('✅ Tất cả đã là WebP rồi!');
    return;
  }

  let converted = 0, failed = 0;
  let savedBytes = 0;

  for (const media of toConvert) {
    const dishName = media.dish?.name ?? 'unknown';
    const oldKey = media.storageKey as string;
    const bucket = (media.bucket as string) ?? BUCKET;

    // Build new key: same path but .webp
    const newKey = oldKey.replace(/\.(jpg|jpeg|png|gif|bmp|tiff|webp)$/i, '.webp');

    process.stdout.write(`  🍽  ${dishName} — ${oldKey} → ${newKey}...`);

    try {
      // 1. Download original from Supabase Storage
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${oldKey}`;
      const res = await httpGet(publicUrl);
      if (res.status !== 200 || res.data.length < 500) {
        process.stdout.write(` ✗ download failed (${res.status})\n`);
        failed++;
        continue;
      }

      const originalSize = res.data.length;

      // 2. Convert to WebP
      const webpBuf = await toWebP(res.data);
      const webpSize = webpBuf.length;
      const saved = originalSize - webpSize;
      savedBytes += saved > 0 ? saved : 0;

      // 3. Upload WebP
      const { error: upError } = await supabase.storage.from(bucket).upload(newKey, webpBuf, {
        contentType: 'image/webp',
        upsert: true,
      });
      if (upError) {
        process.stdout.write(` ✗ upload error: ${upError.message}\n`);
        failed++;
        continue;
      }

      // 4. Delete old file (nếu key khác)
      if (oldKey !== newKey) {
        await supabase.storage.from(bucket).remove([oldKey]);
      }

      // 5. Update DB — chỉ update storageKey + mimeType + sizeBytes
      await db.dishMedia.update({
        where: { id: media.id },
        data: {
          storageKey: newKey,
          mimeType: 'image/webp',
          sizeBytes: webpSize,
        },
      });

      converted++;
      process.stdout.write(
        ` ✅ ${formatSize(originalSize)} → ${formatSize(webpSize)} (−${formatSize(Math.max(0, saved))})\n`
      );
    } catch (e: any) {
      process.stdout.write(` ✗ ${e.message}\n`);
      failed++;
    }
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`✅ Converted  : ${converted}/${toConvert.length}`);
  console.log(`✗  Thất bại  : ${failed}`);
  console.log(`💾 Tiết kiệm : ${formatSize(savedBytes)}`);

  // Verify storage sau khi xóa
  const { data: remaining } = await supabase.storage.from(BUCKET).list('', { limit: 1000 });
  const recur = async (prefix: string): Promise<number> => {
    const { data } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
    if (!data) return 0;
    let count = 0;
    for (const item of data) {
      if (item.metadata) count++;
      else count += await recur(prefix ? `${prefix}/${item.name}` : item.name);
    }
    return count;
  };
  const remainingCount = await recur('');
  console.log(`📦 Files còn trong bucket: ${remainingCount}`);
}

main().catch(console.error).finally(async () => {
  await db.$disconnect();
  await pool.end();
});
