/**
 * Fix image_url_snapshot = null trong weekly_plan_slots
 * Lấy public URL từ dish_media và cập nhật vào slots
 */
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // Lấy tất cả slots chưa có image
  const slots = await pool.query(`
    SELECT wps.id, wps.dish_id, wps.dish_name_snapshot
    FROM weekly_plan_slots wps
    WHERE wps.image_url_snapshot IS NULL AND wps.dish_id IS NOT NULL
  `);
  console.log(`Found ${slots.rows.length} slots missing image`);

  let updated = 0;
  for (const slot of slots.rows) {
    // Lấy primary media của dish
    const media = await pool.query(`
      SELECT storage_key, bucket FROM dish_media
      WHERE dish_id = $1 AND is_primary = true AND moderation_status = 'APPROVED'
      LIMIT 1
    `, [slot.dish_id]);

    if (media.rows.length > 0) {
      const { storage_key, bucket } = media.rows[0];
      const url = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${storage_key}`;
      await pool.query(`
        UPDATE weekly_plan_slots SET image_url_snapshot = $1 WHERE id = $2
      `, [url, slot.id]);
      updated++;
      console.log(`✅ ${slot.dish_name_snapshot}: ${url.substring(0, 80)}...`);
    } else {
      console.log(`❌ ${slot.dish_name_snapshot}: no media found`);
    }
  }

  console.log(`\nUpdated ${updated}/${slots.rows.length} slots`);
  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
