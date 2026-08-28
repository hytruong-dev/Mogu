import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function main() {
  const r = await pool.query(`
    SELECT id, dish_name_snapshot, version, status, is_locked, swap_count
    FROM weekly_plan_slots 
    WHERE plan_id = '7b84536a-ada9-4c36-8970-da099f608bcf'
    ORDER BY date, meal_slot
    LIMIT 10
  `);
  console.table(r.rows);
  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
