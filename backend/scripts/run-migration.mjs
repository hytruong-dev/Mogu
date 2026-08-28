import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local
config({ path: join(__dirname, '..', '.env.local') });

const DIRECT_URL = process.env.DIRECT_URL;
if (!DIRECT_URL) {
  console.error('❌ DIRECT_URL không được set trong .env.local');
  process.exit(1);
}

const sqlFile = join(__dirname, '..', 'prisma', 'migrations', '20260812_dish_module_ba004', 'migration.sql');
const sql = readFileSync(sqlFile, 'utf-8');

const client = new pg.Client({ connectionString: DIRECT_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log('🔗 Kết nối DB...');
  await client.connect();
  console.log('✅ Đã kết nối. Đang chạy migration BA-004...');
  
  try {
    await client.query(sql);
    console.log('✅ Migration BA-004 hoàn tất thành công!');
  } catch (err) {
    console.error('❌ Migration thất bại:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
