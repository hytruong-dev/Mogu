import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const r = await pool.query(`
    SELECT 
      wp.id, wp.status, wp.user_id,
      wp.start_date::date as start_date,
      (SELECT COUNT(*) FROM weekly_plan_slots WHERE plan_id = wp.id) as slot_count,
      wp.generation_error_code,
      wp.created_at::timestamp(0) as created_at
    FROM weekly_plans wp 
    ORDER BY wp.created_at DESC 
    LIMIT 10
  `);
  console.table(r.rows);

  // Delete all GENERATING/FAILED plans to clean up
  const del = await pool.query(`
    DELETE FROM weekly_plans WHERE status IN ('GENERATING', 'FAILED') RETURNING id, status
  `);
  console.log('Deleted stale plans:', del.rows);

  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
