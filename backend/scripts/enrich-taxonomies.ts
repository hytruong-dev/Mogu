import * as path from 'path';
import * as dotenv from 'dotenv';
import pg from 'pg';
import {
  ENRICHED_CATEGORIES,
  ENRICHED_DIET_TYPES,
  ENRICHED_ALLERGENS,
} from '../src/taxonomy/constants/taxonomy.constants';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

async function enrichTaxonomies() {
  const pool = new pg.Pool({
    connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
  });

  try {
    console.log('=== BẮT ĐẦU NÂNG CẤP VÀ LÀM GIÀU 3 DANH MỤC TAXONOMY ===\n');

    // 1. DISH CATEGORIES
    console.log(`▶ 1. Cập nhật Danh mục món ăn (${ENRICHED_CATEGORIES.length} danh mục)...`);
    // Sửa mã 'LẨU' cũ nếu có thành 'LAU'
    await pool.query(`UPDATE dish_categories SET code = 'LAU' WHERE code = 'LẨU'`);

    for (const cat of ENRICHED_CATEGORIES) {
      await pool.query(
        `
        INSERT INTO dish_categories (id, code, name, description, is_active, display_order, created_at)
        VALUES (gen_random_uuid(), $1, $2, $3, true, $4, NOW())
        ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          is_active = true,
          display_order = EXCLUDED.display_order
      `,
        [cat.code, cat.name, cat.description, cat.displayOrder]
      );
    }
    const catCount = await pool.query('SELECT count(*) FROM dish_categories WHERE is_active = true');
    console.log(`  ✓ Đã cập nhật đầy đủ: ${catCount.rows[0].count} danh mục món ăn.`);

    // 2. DIET TYPES
    console.log(`\n▶ 2. Cập nhật Chế độ ăn (${ENRICHED_DIET_TYPES.length} chế độ)...`);
    for (const dt of ENRICHED_DIET_TYPES) {
      await pool.query(
        `
        INSERT INTO diet_types (id, code, name, description, is_active, display_order, created_at)
        VALUES (gen_random_uuid(), $1, $2, $3, true, $4, NOW())
        ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          is_active = true,
          display_order = EXCLUDED.display_order
      `,
        [dt.code, dt.name, dt.description, dt.displayOrder]
      );
    }
    const dtCount = await pool.query('SELECT count(*) FROM diet_types WHERE is_active = true');
    console.log(`  ✓ Đã cập nhật đầy đủ: ${dtCount.rows[0].count} chế độ ăn.`);

    // 3. ALLERGENS
    console.log(`\n▶ 3. Cập nhật Dị ứng thực phẩm (${ENRICHED_ALLERGENS.length} loại dị ứng)...`);
    for (const alg of ENRICHED_ALLERGENS) {
      await pool.query(
        `
        INSERT INTO allergens (id, code, name, description, active, display_order, created_at)
        VALUES (gen_random_uuid(), $1, $2, $3, true, $4, NOW())
        ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          active = true,
          display_order = EXCLUDED.display_order
      `,
        [alg.code, alg.name, alg.description, alg.displayOrder]
      );
    }
    const algCount = await pool.query('SELECT count(*) FROM allergens WHERE active = true');
    console.log(`  ✓ Đã cập nhật đầy đủ: ${algCount.rows[0].count} loại dị ứng.`);

    console.log('\n=== HOÀN TẤT BỔ SUNG DỮ LIỆU TAXONOMY THÀNH CÔNG! ===');
  } finally {
    await pool.end();
  }
}

enrichTaxonomies().catch(console.error);
