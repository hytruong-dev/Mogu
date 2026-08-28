import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // Lấy tên cột của dish_media
  const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'dish_media' ORDER BY ordinal_position`);
  console.log('dish_media columns:', cols.rows.map((r: any) => r.column_name).join(', '));

  // Lấy dish cụ thể từ plan
  const r1 = await pool.query(`SELECT * FROM dish_media WHERE dish_id = 'add36954-90b6-4a8e-a04c-3df85f61a4fe' LIMIT 5`);
  console.log('=== Cơm chiên Dương Châu media ===');
  console.table(r1.rows);

  // Kiểm tra field imageUrl trong weekly_plan_slots
  const r2 = await pool.query(`
    SELECT wps.id, wps.dish_name_snapshot, wps.image_url_snapshot
    FROM weekly_plan_slots wps
    ORDER BY wps.created_at DESC
    LIMIT 10
  `);
  console.log('=== Weekly plan slots image_url_snapshot ===');
  console.table(r2.rows);

  // Check số dish có media vs không có
  const r3 = await pool.query(`
    SELECT 
      COUNT(*) as total_dishes,
      COUNT(dm.id) as dishes_with_media,
      COUNT(CASE WHEN dm.is_primary = true THEN 1 END) as dishes_with_primary
    FROM dishes d
    LEFT JOIN dish_media dm ON dm.dish_id = d.id AND dm.is_primary = true
    WHERE d.status = 'PUBLISHED' AND d.deleted_at IS NULL
  `);
  console.log('=== Media coverage ===');
  console.table(r3.rows);

  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
