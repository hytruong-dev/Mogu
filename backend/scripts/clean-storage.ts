/**
 * clean-storage.ts
 * Xóa các files orphan trong Supabase Storage (không có trong DB)
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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

async function listAllFiles(bucket: string): Promise<{ name: string; size: number; path: string }[]> {
  const files: { name: string; size: number; path: string }[] = [];
  async function listFolder(prefix: string) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error || !data) return;
    for (const item of data) {
      if (item.metadata) {
        files.push({ name: item.name, size: item.metadata.size ?? 0, path: prefix ? `${prefix}/${item.name}` : item.name });
      } else {
        await listFolder(prefix ? `${prefix}/${item.name}` : item.name);
      }
    }
  }
  await listFolder('');
  return files;
}

async function deleteBatch(bucket: string, paths: string[]): Promise<number> {
  const BATCH = 100;
  let deleted = 0;
  for (let i = 0; i < paths.length; i += BATCH) {
    const batch = paths.slice(i, i + BATCH);
    const { data, error } = await supabase.storage.from(bucket).remove(batch);
    if (error) {
      console.error(`  ⚠ Lỗi xóa batch: ${error.message}`);
    } else {
      deleted += data?.length ?? batch.length;
    }
  }
  return deleted;
}

async function main() {
  console.log('🧹 Clean Storage — xóa files orphan\n');

  // ── Load DB keys ───────────────────────────────────────────────────────────
  const ingredients = await db.ingredient.findMany({
    where: {},
    select: { imageKey: true },
  });
  const ingredientKeys = new Set(
    ingredients
      .filter((i: any) => i.imageKey)
      .map((i: any) => i.imageKey as string)
  );

  const dishMediaRaw = await db.dishMedia.findMany({
    select: { storageKey: true, bucket: true },
  }).catch(() => [] as any[]);
  const dishKeys = new Set(
    dishMediaRaw
      .filter((m: any) => m.storageKey)
      .map((m: any) => m.storageKey as string)
  );

  console.log(`📊 DB keys: ingredient-images=${ingredientKeys.size} | dish-images=${dishKeys.size}\n`);

  const { data: buckets } = await supabase.storage.listBuckets();
  let totalDeleted = 0;
  let totalFreed = 0;

  for (const bucket of buckets ?? []) {
    console.log(`${'─'.repeat(50)}`);
    console.log(`🗂️  Bucket: ${bucket.name}`);

    const files = await listAllFiles(bucket.name);
    if (!files.length) { console.log('  (trống)\n'); continue; }

    // Tìm orphans
    const orphans = files.filter(f => {
      if (bucket.name === 'ingredient-images') {
        return !ingredientKeys.has(f.path) && !ingredientKeys.has(f.name);
      }
      if (bucket.name === 'dish-images') {
        return !dishKeys.has(f.path) && !dishKeys.has(f.name);
      }
      return false; // unknown bucket — không xóa
    });

    const orphanSize = orphans.reduce((s, f) => s + f.size, 0);
    console.log(`  Files: ${files.length} | Orphan: ${orphans.length} (${formatSize(orphanSize)})`);

    if (!orphans.length) {
      console.log('  ✓ Không có orphan\n');
      continue;
    }

    // Hiển thị danh sách sẽ xóa
    console.log('\n  Files sẽ xóa:');
    for (const o of orphans.slice(0, 15)) {
      console.log(`    🗑  ${o.path} (${formatSize(o.size)})`);
    }
    if (orphans.length > 15) {
      console.log(`    ... và ${orphans.length - 15} files khác`);
    }

    // Xóa
    console.log(`\n  ⏳ Đang xóa ${orphans.length} files...`);
    const paths = orphans.map(o => o.path);
    const deleted = await deleteBatch(bucket.name, paths);
    totalDeleted += deleted;
    totalFreed += orphanSize;
    console.log(`  ✅ Đã xóa ${deleted} files (giải phóng ${formatSize(orphanSize)})\n`);
  }

  console.log('═'.repeat(50));
  console.log(`✅ Tổng xóa: ${totalDeleted} files`);
  console.log(`💾 Giải phóng: ${formatSize(totalFreed)}`);

  // Verify lại
  console.log('\n📊 Kiểm tra sau khi xóa:');
  for (const bucket of buckets ?? []) {
    const remaining = await listAllFiles(bucket.name);
    const totalSize = remaining.reduce((s, f) => s + f.size, 0);
    console.log(`  ${bucket.name}: ${remaining.length} files (${formatSize(totalSize)})`);
  }
}

main().catch(console.error).finally(async () => {
  await db.$disconnect();
  await pool.end();
});
