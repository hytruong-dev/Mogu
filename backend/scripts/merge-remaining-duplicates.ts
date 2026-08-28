/**
 * merge-remaining-duplicates.ts
 * Merge nốt các nhóm còn lại cần merge
 */
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function mergeInto(keepId: string, deleteIds: string[]) {
  let total = 0;
  for (const delId of deleteIds) {
    const { rowCount } = await pool.query(
      'UPDATE dish_ingredients SET ingredient_id = $1 WHERE ingredient_id = $2',
      [keepId, delId]
    );
    total += rowCount ?? 0;
    await pool.query('DELETE FROM ingredients WHERE id = $1', [delId]);
  }
  return total;
}

async function main() {
  // 1. Bánh phở tươi → merge tất cả vào "Bánh phở tươi"
  {
    const keep = 'b0d85147-f9a7-4f9e-8d20-6587fddd9b99';
    const del = [
      '9fd486e8-b993-4d10-82c8-da07e6483ce5',
      'cab8730b-d14f-48f6-b823-960398d8324e',
      '3fb18a59-31ac-4cb8-b3e2-42c33f161e93',
    ];
    const n = await mergeInto(keep, del);
    console.log(`✅ Bánh phở tươi: merged ${del.length} duplicates, re-linked ${n} DishIngredients`);
  }

  // 2. Ớt sừng → merge vào "Ớt sừng"
  {
    const keep = 'd5cfc13e-1ea4-4d5e-826a-005196d8f32d';
    const del = [
      '71a22ebd-e476-4f2b-a166-d8951455c3b7',
      '2e612aca-8c9c-4a8b-a8d9-be5e6f386f19',
    ];
    const n = await mergeInto(keep, del);
    console.log(`✅ Ớt sừng: merged ${del.length} duplicates, re-linked ${n} DishIngredients`);
  }

  // 3. Rau muống bào → merge vào "Rau muống bào (hoặc cần tây, hành lá)"
  {
    const keep = '67fb8119-3abe-4f7a-925f-458fadc9e82b';
    const del = ['6fcaf624-8292-4585-a224-d59cb41761c4'];
    const n = await mergeInto(keep, del);
    console.log(`✅ Rau muống bào: merged ${del.length} duplicates, re-linked ${n} DishIngredients`);
  }

  // Final count
  const { rows } = await pool.query('SELECT COUNT(*) FROM ingredients WHERE is_active = true');
  console.log(`\n📦 Remaining ingredients: ${rows[0].count}`);

  pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
