/**
 * add-rating-trigger.ts
 * Tạo DB trigger để tự động cập nhật rating_avg + rating_count trên bảng dishes
 * sau mỗi INSERT/UPDATE/DELETE trên bảng reviews.
 *
 * Đây là failsafe song song với app-level sync trong reviews.service.ts
 *
 * Chạy: npx tsx scripts/add-rating-trigger.ts
 */
import * as dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '.env.local' });

async function main() {
  const pool = new (pg.Pool)({
    connectionString: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL,
  });

  console.log('🔧 Tạo trigger trg_update_dish_rating...');

  await pool.query(`
    -- Function: tính lại avg + count cho dish
    CREATE OR REPLACE FUNCTION trg_sync_dish_rating()
    RETURNS trigger AS $$
    DECLARE
      v_dish_id UUID;
    BEGIN
      -- Xác định dish_id từ row hiện tại hoặc row cũ (trường hợp DELETE)
      IF TG_OP = 'DELETE' THEN
        v_dish_id := OLD.dish_id;
      ELSE
        v_dish_id := NEW.dish_id;
      END IF;

      -- Cập nhật denormalized rating trên dishes
      UPDATE dishes
      SET
        rating_avg   = COALESCE(
          (SELECT AVG(rating)::DECIMAL(3,2)
           FROM reviews
           WHERE dish_id = v_dish_id AND is_visible = true),
          0
        ),
        rating_count = (
          SELECT COUNT(*)::INT
          FROM reviews
          WHERE dish_id = v_dish_id AND is_visible = true
        ),
        updated_at = NOW()
      WHERE id = v_dish_id;

      RETURN NULL; -- AFTER trigger, return value ignored for row triggers
    END;
    $$ LANGUAGE plpgsql;
  `);

  console.log('  ✅ Function trg_sync_dish_rating() đã tạo');

  await pool.query(`
    -- Drop trigger cũ nếu tồn tại
    DROP TRIGGER IF EXISTS trg_update_dish_rating ON reviews;

    -- Tạo trigger mới (AFTER để đọc dữ liệu sau khi đã commit)
    CREATE TRIGGER trg_update_dish_rating
    AFTER INSERT OR UPDATE OR DELETE ON reviews
    FOR EACH ROW EXECUTE FUNCTION trg_sync_dish_rating();
  `);

  console.log('  ✅ Trigger trg_update_dish_rating đã tạo');

  // Backfill: cập nhật tất cả dishes hiện có
  console.log('\n📊 Backfill: cập nhật rating_avg + rating_count cho tất cả dishes...');

  const result = await pool.query(`
    UPDATE dishes d
    SET
      rating_avg = COALESCE(
        (SELECT AVG(r.rating)::DECIMAL(3,2)
         FROM reviews r
         WHERE r.dish_id = d.id AND r.is_visible = true),
        0
      ),
      rating_count = (
        SELECT COUNT(*)::INT
        FROM reviews r
        WHERE r.dish_id = d.id AND r.is_visible = true
      ),
      updated_at = NOW()
    WHERE deleted_at IS NULL
    RETURNING id;
  `);

  console.log(`  ✅ Đã backfill ${result.rowCount} món ăn`);

  await pool.end();
  console.log('\n✅ Hoàn thành! Trigger rating sẽ tự động chạy sau mỗi thay đổi trên bảng reviews.');
}

main().catch((err) => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
