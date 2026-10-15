import * as path from 'path';
import * as dotenv from 'dotenv';
import pg from 'pg';
import { FINAL_38_INGREDIENTS } from './verify-all-images';
import { IngredientNormalizerService } from '../src/ingredients/ingredient-normalizer.service';
import * as crypto from 'crypto';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

function generateCode(): string {
  return 'ING-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

async function insertNewIngredients() {
  const pool = new pg.Pool({
    connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
  });

  const normalizer = new IngredientNormalizerService();

  try {
    const existingRes = await pool.query('SELECT code, identity_normalized, search_folded FROM ingredients');
    const existingCodes = new Set(existingRes.rows.map((r) => r.code));
    const existingIdentities = new Set(existingRes.rows.map((r) => r.identity_normalized));
    const existingFolded = new Set(existingRes.rows.map((r) => r.search_folded));

    console.log(`Hiện tại DB có ${existingRes.rows.length} nguyên liệu.`);

    let inserted = 0;
    let skipped = 0;

    for (const item of FINAL_38_INGREDIENTS) {
      const identityNorm = normalizer.identityKey(item.name);
      const searchFold = normalizer.searchFolded(item.name);

      if (existingIdentities.has(identityNorm) || existingFolded.has(searchFold)) {
        console.log(`- Bỏ qua "${item.name}" vì đã tồn tại.`);
        skipped++;
        continue;
      }

      let code = generateCode();
      while (existingCodes.has(code)) {
        code = generateCode();
      }
      existingCodes.add(code);
      existingIdentities.add(identityNorm);
      existingFolded.add(searchFold);

      await pool.query(
        `
        INSERT INTO ingredients (
          id, code, name, group_label, unit, image_url, image_status,
          is_active, status, created_via, identity_normalized, search_folded,
          synonyms, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, 'PENDING_REVIEW',
          false, 'PENDING_REVIEW', 'FILE_IMPORT', $6, $7,
          $8, NOW(), NOW()
        )
      `,
        [code, item.name, item.group_label, item.unit, item.image_url, identityNorm, searchFold, []]
      );

      console.log(`+ Đã thêm [${item.group_label}] ${item.name} (${code})`);
      inserted++;
    }

    const countRes = await pool.query(`
      SELECT 
        count(*) as total,
        count(*) FILTER (WHERE is_active = true) as active,
        count(*) FILTER (WHERE is_active = false) as inactive
      FROM ingredients
    `);

    console.log(`\n=== KẾT QUẢ INSERT ===`);
    console.log(`- Đã thêm mới: ${inserted} nguyên liệu (is_active = false)`);
    console.log(`- Bỏ qua: ${skipped}`);
    console.log(`- Tổng nguyên liệu trong DB: ${countRes.rows[0].total}`);
    console.log(`- Đang kích hoạt (Active): ${countRes.rows[0].active}`);
    console.log(`- Chờ duyệt (Inactive/Pending Review): ${countRes.rows[0].inactive}`);
  } finally {
    await pool.end();
  }
}

insertNewIngredients().catch(console.error);
