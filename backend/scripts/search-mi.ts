import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query("SELECT id, name, image_url FROM ingredients WHERE name ILIKE '%cao%' OR name ILIKE '%Mi%' ORDER BY name LIMIT 20")
  .then(r => {
    r.rows.forEach((x: any) => console.log(`${x.id} | ${x.name} | ${x.image_url ? 'HAS_IMG' : 'NO_IMG'}`));
    pool.end();
  })
  .catch(e => { console.error(e); pool.end(); });
