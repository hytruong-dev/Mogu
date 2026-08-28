import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function main() {
  const r = await pool.query(`
    SELECT 
      wp.id,
      wp.status,
      wp.budget_limit_vnd,
      wp.projected_cost_vnd,
      wp.version,
      COUNT(wps.id) as slot_count,
      SUM(wps.price_snapshot_vnd) as total_price_snapshot
    FROM weekly_plans wp
    LEFT JOIN weekly_plan_slots wps ON wps.plan_id = wp.id
    WHERE wp.id = '7b84536a-ada9-4c36-8970-da099f608bcf'
    GROUP BY wp.id
  `);
  console.table(r.rows);
  
  // Check slot d9390e16
  const slot = await pool.query(`
    SELECT id, dish_name_snapshot, meal_slot, price_snapshot_vnd, kcal_snapshot, version, status
    FROM weekly_plan_slots
    WHERE id = 'd9390e16-7233-40ca-b091-c58e3574e823'
  `);
  console.log('\n=== Slot to swap ===');
  console.table(slot.rows);
  
  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
