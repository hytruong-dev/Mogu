import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // Lấy user có weekly plan
  const users = await pool.query(`
    SELECT DISTINCT wp.user_id, p.display_name
    FROM weekly_plans wp
    JOIN profiles p ON p.user_id = wp.user_id
    LIMIT 5
  `);
  console.log('Users with plans:', users.rows);

  // Lấy slots với dish media
  const r = await pool.query(`
    SELECT 
      wps.id AS slot_id,
      wps.dish_name_snapshot,
      wps.image_url_snapshot,
      dm.storage_key,
      dm.bucket
    FROM weekly_plan_slots wps
    LEFT JOIN dish_media dm ON dm.dish_id = wps.dish_id AND dm.is_primary = true
    ORDER BY wps.created_at DESC
    LIMIT 5
  `);
  console.log('=== Slots with media ===');
  console.table(r.rows);
  
  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
