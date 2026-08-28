/**
 * merge-duplicate-ingredients.ts
 *
 * Logic:
 * 1. Group tất cả Ingredient records theo "tên chuẩn" (bỏ phần trong ngoặc, bỏ "hoặc...")
 * 2. Với mỗi group có > 1 record:
 *    - Chọn record "canonical" = tên ngắn nhất, không có ngoặc
 *    - Ưu tiên record đã có ảnh từ Supabase Storage (nội bộ)
 *    - Chuyển tất cả DishIngredient.ingredientId → canonical
 *    - Xóa các duplicates
 * 3. Report kết quả
 *
 * Một số nhóm đặc biệt không nên merge (vì là nguyên liệu thực sự khác nhau):
 * - "Bánh phở tươi (sợi to)" vs "Bánh phở tươi (sợi nhỏ)" → khác nhau thật
 * - "Bánh tráng nướng (dày)" vs "Bánh tráng nướng (mè)" → khác
 * - "Đồ chua (cà rốt, củ cải)" vs "Đồ chua (cà rốt, đu đủ)" → thực sự khác
 * - "Củ cải trắng" vs "Củ cải trắng (hoặc đu đủ)" → có thể merge
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function normalize(s: string): string {
  return s
    .replace(/\s*\(.*?\)\s*/g, '')           // xóa phần trong ngoặc
    .replace(/\s*(hoặc|hoac|hay)\s+.*/i, '') // xóa "hoặc ..."
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Các nhóm KHÔNG merge vì chúng là nguyên liệu thực sự khác nhau
// (e.g. kích thước, loại khác nhau ảnh hưởng đến món ăn)
const DO_NOT_MERGE_PATTERNS = new Set([
  'banh pho tuoi',        // sợi to vs sợi nhỏ → khác nhau về kích thước
  'banh trang nuong',     // dày vs mè → khác loại
  'do chua',              // cà rốt+củ cải vs cà rốt+đu đủ → thực sự khác
  'rau muong bao',        // hoặc cần tây vs hoặc rau cần → tương tự nhưng để nguyên
  'ot sung',              // ớt sừng vs ớt sừng hoặc hiểm → để nguyên
]);

// Score để chọn canonical: ưu tiên record ngắn nhất, không ngoặc
function canonicalScore(name: string, imageUrl: string | null): number {
  let score = 0;
  // Không có ngoặc = +10
  if (!name.includes('(')) score += 10;
  // Không có "hoặc" = +5
  if (!/hoặc|hoac|hay/i.test(name)) score += 5;
  // Tên ngắn hơn = +điểm
  score += Math.max(0, 50 - name.length);
  // Có ảnh Supabase (nội bộ) = +3
  if (imageUrl?.includes('supabase.co')) score += 3;
  // Có ảnh = +1
  if (imageUrl) score += 1;
  return score;
}

async function main() {
  const { rows } = await pool.query(`
    SELECT id, name, code, image_url, created_at
    FROM ingredients
    WHERE is_active = true
    ORDER BY name
  `);

  console.log(`📦 Total ingredients: ${rows.length}`);

  // Group by normalized name
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = normalize(row.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  let totalMerged = 0;
  let totalDeleted = 0;
  let skipped = 0;

  for (const [key, items] of groups) {
    if (items.length <= 1) continue;

    // Check skip list
    if (DO_NOT_MERGE_PATTERNS.has(key)) {
      console.log(`\n⏭️  SKIP [${key}] — ${items.length} records (intentionally different variants)`);
      skipped++;
      continue;
    }

    // Sort by canonical score descending → best candidate first
    items.sort((a: any, b: any) =>
      canonicalScore(b.name, b.image_url) - canonicalScore(a.name, a.image_url)
    );

    const canonical = items[0];
    const duplicates = items.slice(1);

    console.log(`\n🔀 MERGE [${key}]`);
    console.log(`   ✅ KEEP: "${canonical.name}" [${canonical.id.substring(0, 8)}]${canonical.image_url ? ' 🖼️' : ''}`);

    for (const dup of duplicates) {
      // Check if dup has a better image (Supabase internal) that canonical doesn't have
      const dupHasSupabaseImg = dup.image_url?.includes('supabase.co');
      const canonHasSupabaseImg = canonical.image_url?.includes('supabase.co');

      // If dup has Supabase image but canonical doesn't, copy it first
      if (dupHasSupabaseImg && !canonHasSupabaseImg && dup.image_url) {
        await pool.query(
          'UPDATE ingredients SET image_url = $1 WHERE id = $2',
          [dup.image_url, canonical.id]
        );
        canonical.image_url = dup.image_url;
        console.log(`   📸 Copied better image from "${dup.name}"`);
      }

      // Re-link all DishIngredients pointing to dup → canonical
      const { rowCount } = await pool.query(
        'UPDATE dish_ingredients SET ingredient_id = $1 WHERE ingredient_id = $2',
        [canonical.id, dup.id]
      );
      if ((rowCount ?? 0) > 0) {
        console.log(`   🔗 Re-linked ${rowCount} DishIngredients from "${dup.name}"`);
      }

      // Delete the duplicate
      await pool.query('DELETE FROM ingredients WHERE id = $1', [dup.id]);
      console.log(`   🗑️  DELETE: "${dup.name}" [${dup.id.substring(0, 8)}]`);
      totalDeleted++;
    }

    totalMerged++;
  }

  // Final count
  const { rows: final } = await pool.query('SELECT COUNT(*) FROM ingredients WHERE is_active = true');
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ DONE!`);
  console.log(`   Groups merged: ${totalMerged}`);
  console.log(`   Records deleted: ${totalDeleted}`);
  console.log(`   Groups skipped: ${skipped}`);
  console.log(`   Remaining ingredients: ${final[0].count}`);

  pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
