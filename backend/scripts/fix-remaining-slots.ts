/**
 * Fix image_url_snapshot cho tất cả slots còn null
 * Không filter moderation_status — lấy bất kỳ ảnh primary nào
 */
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // Kiểm tra media của 6 món bị thiếu
  const checkDishes = [
    'Gà kho gừng', 'Bún thịt nướng Miền Trung', 'Bánh cuốn miền Bắc',
    'Cá kho tộ (kiểu Miền Nam)', 'Bánh xèo miền Trung', 'Cao lầu Hội An'
  ];

  console.log('=== Kiểm tra dish_media ===');
  for (const name of checkDishes) {
    const r = await pool.query(`
      SELECT d.id, d.name, dm.storage_key, dm.bucket, dm.moderation_status, dm.is_primary
      FROM dishes d
      LEFT JOIN dish_media dm ON dm.dish_id = d.id
      WHERE d.name = $1 AND d.deleted_at IS NULL
    `, [name]);
    if (r.rows.length === 0) {
      console.log(`❌ ${name}: không tìm thấy trong dishes`);
    } else if (!r.rows[0].storage_key) {
      console.log(`❌ ${name}: dish tồn tại nhưng KHÔNG có dish_media`);
    } else {
      r.rows.forEach(row => console.log(`  ${name}: status=${row.moderation_status}, primary=${row.is_primary}, key=${row.storage_key?.substring(0,50)}`));
    }
  }

  // Fix: update tất cả slots null — bỏ filter moderation_status
  console.log('\n=== Fixing slots ===');
  const slots = await pool.query(`
    SELECT wps.id AS slot_id, wps.dish_id, wps.dish_name_snapshot
    FROM weekly_plan_slots wps
    WHERE wps.image_url_snapshot IS NULL AND wps.dish_id IS NOT NULL
  `);
  console.log(`Found ${slots.rows.length} slots missing image`);

  let updated = 0;
  for (const slot of slots.rows) {
    const media = await pool.query(`
      SELECT storage_key, bucket FROM dish_media
      WHERE dish_id = $1 AND is_primary = true
      ORDER BY created_at DESC
      LIMIT 1
    `, [slot.dish_id]);

    if (media.rows.length === 0) {
      // Fallback: lấy bất kỳ ảnh nào
      const anyMedia = await pool.query(`
        SELECT storage_key, bucket FROM dish_media
        WHERE dish_id = $1
        ORDER BY created_at DESC LIMIT 1
      `, [slot.dish_id]);
      if (anyMedia.rows.length === 0) {
        console.log(`  ❌ ${slot.dish_name_snapshot}: không có media nào`);
        continue;
      }
      media.rows.push(anyMedia.rows[0]);
    }

    const { storage_key, bucket } = media.rows[0];
    const url = `${SUPABASE_URL}/storage/v1/object/public/${bucket ?? 'dish-images'}/${storage_key}`;
    await pool.query(`
      UPDATE weekly_plan_slots SET image_url_snapshot = $1 WHERE id = $2
    `, [url, slot.slot_id]);
    updated++;
    console.log(`  ✅ ${slot.dish_name_snapshot}: ${url.substring(0, 80)}...`);
  }

  console.log(`\nUpdated ${updated}/${slots.rows.length} slots`);
  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
