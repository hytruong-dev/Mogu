import * as dotenv from 'dotenv';
import pg from 'pg';
dotenv.config({ path: '.env.local' });

async function main() {
  const pool = new (pg.Pool)({ connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL });
  await pool.query(`ALTER TABLE allergens ADD COLUMN IF NOT EXISTS description TEXT;`);
  console.log('✅ Đã thêm column description vào bảng allergens');
  await pool.end();
}
main().catch(console.error);
