import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(`SELECT dish_name_snapshot, image_url_snapshot FROM weekly_plan_slots WHERE dish_id = 'add36954-90b6-4a8e-a04c-3df85f61a4fe'`)
  .then(r => { console.table(r.rows); pool.end(); })
  .catch(e => { console.error(e.message); pool.end(); });
