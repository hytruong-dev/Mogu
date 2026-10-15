import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import pg from 'pg';
import { FIXED_28_IMAGES } from './verify-fixed-28';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

async function apply28Images() {
  const pool = new pg.Pool({
    connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL,
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log(`Bắt đầu cập nhật 28 hình ảnh nguyên liệu chuẩn đẹp vào PostgreSQL...`);

    let updatedCount = 0;
    for (const [name, info] of Object.entries(FIXED_28_IMAGES)) {
      const res = await client.query(
        `
        UPDATE ingredients
        SET image_url = $1,
            image_status = 'PENDING_REVIEW',
            updated_at = NOW()
        WHERE name = $2
        RETURNING id, name, image_url, is_active, status;
      `,
        [info.url, name]
      );

      if (res.rows.length > 0) {
        console.log(`✓ [${name}]: ${info.note}`);
        updatedCount++;
      } else {
        console.warn(`! Không tìm thấy nguyên liệu: ${name}`);
      }
    }

    await client.query('COMMIT');
    console.log(`\nHoàn tất DB: Đã cập nhật thành công ${updatedCount}/28 nguyên liệu!`);

    // 1. Cập nhật file new-ingredients-prepared.json
    const prepPath = path.join(__dirname, '../data/new-ingredients-prepared.json');
    if (fs.existsSync(prepPath)) {
      const prepItems = JSON.parse(fs.readFileSync(prepPath, 'utf8'));
      for (const item of prepItems) {
        if (FIXED_28_IMAGES[item.name]) {
          item.imageUrl = FIXED_28_IMAGES[item.name].url;
        }
      }
      fs.writeFileSync(prepPath, JSON.stringify(prepItems, null, 2), 'utf8');
      console.log(`Đã cập nhật file: ${prepPath}`);
    }

    // 2. Cập nhật file multi-source-clean-ingredients.json
    const msPath = path.join(__dirname, '../data/multi-source-clean-ingredients.json');
    if (fs.existsSync(msPath)) {
      const msItems = JSON.parse(fs.readFileSync(msPath, 'utf8'));
      for (const item of msItems) {
        if (FIXED_28_IMAGES[item.name]) {
          item.imageUrl = FIXED_28_IMAGES[item.name].url;
        }
      }
      fs.writeFileSync(msPath, JSON.stringify(msItems, null, 2), 'utf8');
      console.log(`Đã cập nhật file: ${msPath}`);
    }
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Lỗi khi cập nhật:', e);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

apply28Images().catch(console.error);
