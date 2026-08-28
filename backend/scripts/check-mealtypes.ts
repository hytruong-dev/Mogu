import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function main() {
  const r = await pool.query(`SELECT id, code, name FROM meal_type_tags ORDER BY id`);
  console.table(r.rows);
  
  // Check how many dishes per meal type
  const r2 = await pool.query(`
    SELECT mt.code, mt.name, COUNT(dmt.dish_id) as dish_count
    FROM meal_type_tags mt
    LEFT JOIN dish_meal_types dmt ON dmt.meal_type_tag_id = mt.id
    GROUP BY mt.id, mt.code, mt.name
  `);
  console.log('=== Dish count per meal type ===');
  console.table(r2.rows);
  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
