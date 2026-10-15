import * as path from 'path';
import * as dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

async function analyzeCurrentIngredients() {
  const pool = new pg.Pool({
    connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
  });

  try {
    const res = await pool.query(`
      SELECT id, name, identity_normalized, group_label, is_active
      FROM ingredients
      ORDER BY group_label, name;
    `);

    const rows = res.rows;
    console.log(`Total ingredients: ${rows.length}`);

    const byGroup: Record<string, string[]> = {};
    for (const r of rows) {
      const g = r.group_label || 'Khác';
      if (!byGroup[g]) byGroup[g] = [];
      byGroup[g].push(r.name);
    }

    for (const [g, names] of Object.entries(byGroup)) {
      console.log(`\n=== Nhóm [${g}] (${names.length} nguyên liệu) ===`);
      console.log(names.join(', '));
    }
  } finally {
    await pool.end();
  }
}

analyzeCurrentIngredients().catch(console.error);
