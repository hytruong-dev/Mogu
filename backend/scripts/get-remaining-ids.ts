import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query(`
  SELECT id, name FROM ingredients 
  WHERE name IN (
    'Bánh phở tươi', 'Bánh phở tươi (loại bản to, sợi dẹt)', 
    'Bánh phở tươi (loại sợi nhỏ, dẹt)', 'Bánh phở tươi (loại sợi to bản)',
    'Ớt sừng', 'Ớt sừng (ăn kèm)', 'Ớt sừng hoặc ớt hiểm',
    'Rau muống bào (hoặc cần tây, hành lá)', 'Rau muống bào (hoặc rau cần)'
  )
  ORDER BY name
`)
.then(r => {
  r.rows.forEach((x: any) => console.log(`"${x.id}", // ${x.name}`));
  pool.end();
})
.catch(e => { console.error(e); pool.end(); });
