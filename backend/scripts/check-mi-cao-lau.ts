import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query("SELECT id, name, image_url FROM ingredients WHERE name IN ('Mì cao lầu', 'Cơm trắng', 'Hành lá')")
  .then(r => { console.log(JSON.stringify(r.rows, null, 2)); pool.end(); })
  .catch(console.error);
