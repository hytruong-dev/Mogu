import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // Lấy tất cả slots của plan mới nhất kèm image_url_snapshot
  const r = await pool.query(`
    SELECT 
      wps.id AS slot_id,
      wps.dish_name_snapshot,
      wps.meal_slot,
      wps.image_url_snapshot,
      dm.storage_key,
      dm.bucket
    FROM weekly_plan_slots wps
    JOIN weekly_plans wp ON wp.id = wps.plan_id
    LEFT JOIN dish_media dm ON dm.dish_id = wps.dish_id AND dm.is_primary = true AND dm.moderation_status = 'APPROVED'
    WHERE wp.status IN ('READY','ACTIVE')
    ORDER BY wps.date, wps.meal_slot
    LIMIT 30
  `);

  console.log('=== Slot images status ===');
  for (const row of r.rows) {
    const hasSnapshot = !!row.image_url_snapshot;
    const hasMedia = !!row.storage_key;
    const status = hasSnapshot ? '✅' : (hasMedia ? '⚠️ has media but no snapshot' : '❌ no media');
    console.log(`${status} | ${row.meal_slot.padEnd(10)} | ${row.dish_name_snapshot}`);
    if (!hasSnapshot && row.storage_key) {
      console.log(`  → storage_key: ${row.storage_key}`);
    }
  }

  // Slots không có snapshot nhưng có media → cần fix
  const missing = r.rows.filter(r => !r.image_url_snapshot && r.storage_key);
  console.log(`\nSlots cần fix: ${missing.length}`);
  
  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
