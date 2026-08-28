import { Pool } from 'pg';
import * as https from 'https';
import * as http from 'http';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;

async function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'MoguBot/1.0' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error(data.substring(0, 200))); } });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function main() {
  // Check Mì cao lầu
  const { rows } = await pool.query(
    "SELECT id, name, image_url FROM ingredients WHERE name IN ('Mì cao lầu', 'Cơm trắng') ORDER BY name"
  );
  console.log('Current state:');
  rows.forEach((r: any) => console.log(`  ${r.name}: ${r.image_url ? r.image_url.substring(0, 60) + '...' : 'NULL'}`));

  const miCaoLau = rows.find((r: any) => r.name === 'Mì cao lầu');
  if (!miCaoLau) { console.log('Mì cao lầu not found'); pool.end(); return; }
  
  if (miCaoLau.image_url) { console.log('\n✅ Mì cao lầu already has image'); pool.end(); return; }

  // Search for image
  let imageUrl: string | null = null;
  
  if (UNSPLASH_KEY) {
    try {
      const queries = [
        'cao lau noodles Hoi An Vietnam',
        'Vietnamese thick wheat noodles yellow turmeric',
        'Hoi An noodle dish pork',
      ];
      for (const q of queries) {
        const data = await fetchJson(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=3&client_id=${UNSPLASH_KEY}`);
        if (data.results?.[0]) {
          imageUrl = data.results[0].urls.regular;
          console.log(`\n📸 Found via Unsplash: ${q}`);
          break;
        }
      }
    } catch (e) { console.error('Unsplash error:', e); }
  }
  
  // Fallback: Wikimedia Commons (hardcode Cao Lầu URL)
  if (!imageUrl) {
    imageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Cao_L%E1%BA%A7u_1.jpg/640px-Cao_L%E1%BA%A7u_1.jpg';
    console.log('\n📖 Using Wikimedia hardcode for Mì cao lầu');
  }

  await pool.query('UPDATE ingredients SET image_url = $1 WHERE id = $2', [imageUrl, miCaoLau.id]);
  console.log(`\n✅ Updated image for "Mì cao lầu": ${imageUrl.substring(0, 80)}`);
  
  pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
