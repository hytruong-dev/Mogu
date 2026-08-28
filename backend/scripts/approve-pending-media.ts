import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(`UPDATE dish_media SET moderation_status = 'APPROVED' WHERE moderation_status = 'PENDING'`)
  .then(r => { console.log(`Approved ${r.rowCount} media records`); pool.end(); })
  .catch(e => { console.error(e.message); pool.end(); });
