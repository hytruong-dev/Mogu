/**
 * Gán meal types cho các dishes chưa có hoặc thiếu
 * - BREAKFAST: bún, phở, bánh cuốn, bánh khọt, bánh xèo (sáng)
 * - LUNCH: cơm các loại, mì, cao lầu, bún (trưa) 
 * - DINNER: thịt kho, cá kho, bún riêu, bò kho, bún đậu (tối)
 * - ALL: nếu dish không có meal type nào → gán cả 3 (BREAKFAST, LUNCH, DINNER)
 */
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // Lấy meal type IDs
  const mtRows = await pool.query(`SELECT id, code FROM meal_type_tags`);
  const mtMap: Record<string, string> = {};
  for (const r of mtRows.rows) mtMap[r.code] = r.id;
  console.log('Meal type IDs:', mtMap);

  // Lấy tất cả dishes với meal types hiện tại
  const dishes = await pool.query(`
    SELECT d.id, d.name,
      ARRAY_AGG(mt.code) FILTER (WHERE mt.code IS NOT NULL) as current_meal_types
    FROM dishes d
    LEFT JOIN dish_meal_types dmt ON dmt.dish_id = d.id
    LEFT JOIN meal_type_tags mt ON mt.id = dmt.meal_type_tag_id
    WHERE d.deleted_at IS NULL AND d.status = 'PUBLISHED'
    GROUP BY d.id, d.name
  `);

  console.log(`\nFound ${dishes.rows.length} published dishes`);

  let updated = 0;
  for (const dish of dishes.rows) {
    const name = dish.name.toLowerCase();
    const currentTypes: string[] = dish.current_meal_types ?? [];

    // Determine which meal types to add
    const toAdd: string[] = [];

    // Sáng: bún, phở, bánh cuốn, bánh khọt, xôi
    if (
      name.includes('bánh khọt') || name.includes('bánh cuốn') || 
      name.includes('phở') || name.includes('xôi') ||
      name.includes('bún đậu')
    ) {
      if (!currentTypes.includes('BREAKFAST')) toAdd.push('BREAKFAST');
    }

    // Trưa: cơm, mì, cao lầu, bánh xèo
    if (
      name.includes('cơm') || name.includes('mì') || name.includes('cao lầu') ||
      name.includes('bánh xèo')
    ) {
      if (!currentTypes.includes('LUNCH')) toAdd.push('LUNCH');
    }

    // Tối: bún riêu, bò kho, thịt kho, cá kho, bún bò, bún thịt nướng
    if (
      name.includes('bún riêu') || name.includes('bò kho') || 
      name.includes('thịt kho') || name.includes('cá kho') ||
      name.includes('bún bò') || name.includes('bún thịt')
    ) {
      if (!currentTypes.includes('DINNER')) toAdd.push('DINNER');
    }

    // Nếu vẫn không có meal type nào → gán tất cả 3 bữa chính
    if (currentTypes.length === 0 && toAdd.length === 0) {
      if (!currentTypes.includes('BREAKFAST')) toAdd.push('BREAKFAST');
      if (!currentTypes.includes('LUNCH')) toAdd.push('LUNCH');
      if (!currentTypes.includes('DINNER')) toAdd.push('DINNER');
    }

    if (toAdd.length > 0) {
      for (const code of toAdd) {
        const mtId = mtMap[code];
        if (!mtId) { console.log(`❌ No ID for ${code}`); continue; }
        await pool.query(
          `INSERT INTO dish_meal_types (dish_id, meal_type_tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [dish.id, mtId]
        );
      }
      console.log(`✅ ${dish.name}: added [${toAdd.join(', ')}]`);
      updated++;
    }
  }

  // Verify final state
  const verify = await pool.query(`
    SELECT mt.code, COUNT(dmt.dish_id) as dish_count
    FROM meal_type_tags mt
    LEFT JOIN dish_meal_types dmt ON dmt.meal_type_tag_id = mt.id
    GROUP BY mt.id, mt.code
  `);
  console.log('\n=== Final meal type distribution ===');
  console.table(verify.rows);

  console.log(`\nUpdated ${updated} dishes`);
  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
