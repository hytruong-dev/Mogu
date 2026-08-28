/**
 * audit-storage.ts
 * Liệt kê tất cả buckets + files trong Supabase Storage
 * So sánh với dữ liệu trong DB để tìm files "orphan" (không có trong DB)
 */
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

async function listAllFiles(bucket: string): Promise<{ name: string; size: number; path: string }[]> {
  const files: { name: string; size: number; path: string }[] = [];

  async function listFolder(prefix: string) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error || !data) return;
    for (const item of data) {
      if (item.metadata) {
        // It's a file
        files.push({ name: item.name, size: item.metadata.size ?? 0, path: prefix ? `${prefix}/${item.name}` : item.name });
      } else {
        // It's a folder — recurse
        await listFolder(prefix ? `${prefix}/${item.name}` : item.name);
      }
    }
  }

  await listFolder('');
  return files;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

async function main() {
  console.log('🔍 Kiểm tra Supabase Storage...\n');

  // List all buckets
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  if (bucketsError) { console.error('Lỗi lấy buckets:', bucketsError); return; }

  console.log(`📦 Buckets (${buckets?.length ?? 0}):`);
  for (const b of buckets ?? []) {
    console.log(`  - ${b.name} (public=${b.public})`);
  }
  console.log();

  // ── Lấy tất cả image keys từ DB ──────────────────────────────────────────
  // 1. ingredient-images
  const ingredients = await db.ingredient.findMany({
    where: { imageKey: { not: null } },
    select: { imageKey: true, name: true },
  });
  const ingredientKeys = new Set(ingredients.map((i: any) => i.imageKey as string));

  // 2. dish-images
  const dishMediaRaw = await db.dishMedia.findMany({
    select: { storageKey: true, bucket: true },
  }).catch(() => [] as any[]);
  const dishMedia = dishMediaRaw.filter((m: any) => m.storageKey);
  const dishKeys = new Set(
    dishMedia
      .filter((m: any) => m.bucket === 'dish-images' || !m.bucket)
      .map((m: any) => m.storageKey as string)
  );

  console.log(`📊 DB references:`);
  console.log(`  ingredient-images keys: ${ingredientKeys.size}`);
  console.log(`  dish-images keys      : ${dishKeys.size}`);
  console.log();

  // ── Phân tích từng bucket ─────────────────────────────────────────────────
  for (const bucket of buckets ?? []) {
    console.log(`\n${'═'.repeat(55)}`);
    console.log(`🗂️  Bucket: ${bucket.name}`);
    console.log('═'.repeat(55));

    const files = await listAllFiles(bucket.name);
    if (!files.length) { console.log('  (trống)'); continue; }

    let totalSize = 0;
    let orphanCount = 0;
    let orphanSize = 0;
    const orphans: typeof files = [];

    for (const f of files) {
      totalSize += f.size;

      let inDB = false;
      if (bucket.name === 'ingredient-images') {
        inDB = ingredientKeys.has(f.path) || ingredientKeys.has(f.name);
      } else if (bucket.name === 'dish-images') {
        inDB = dishKeys.has(f.path) || dishKeys.has(f.name);
      } else {
        inDB = true; // unknown bucket — assume all used
      }

      if (!inDB) {
        orphanCount++;
        orphanSize += f.size;
        orphans.push(f);
      }
    }

    console.log(`  Tổng files  : ${files.length} (${formatSize(totalSize)})`);
    console.log(`  Có trong DB : ${files.length - orphanCount}`);
    console.log(`  Orphan      : ${orphanCount} (${formatSize(orphanSize)}) ← có thể xóa`);

    if (orphans.length > 0 && orphans.length <= 30) {
      console.log('\n  Orphan files:');
      for (const o of orphans) {
        console.log(`    - ${o.path} (${formatSize(o.size)})`);
      }
    } else if (orphans.length > 30) {
      console.log(`\n  (${orphans.length} orphan files — quá nhiều để liệt kê)`);
    }
  }

  console.log('\n');
}

main().catch(console.error).finally(async () => {
  await db.$disconnect();
  await pool.end();
});
