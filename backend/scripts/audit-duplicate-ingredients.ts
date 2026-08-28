/**
 * audit-duplicate-ingredients.ts
 * Liệt kê tất cả Ingredient records và nhóm các duplicates
 */
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function normalize(s: string): string {
  return s
    .replace(/\s*\(.*?\)\s*/g, '') // xóa phần trong ngoặc ()
    .replace(/\s*(hoặc|hoac|hay)\s+.*/i, '') // xóa "hoặc ..."
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const { rows } = await pool.query(`
    SELECT id, name, code, image_url, created_at
    FROM ingredients
    WHERE is_active = true
    ORDER BY name
  `);

  console.log(`Total ingredients: ${rows.length}\n`);

  // Group by normalized name
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = normalize(row.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  // Find groups with duplicates
  let dupCount = 0;
  const dupGroups: Array<{ key: string; items: typeof rows }> = [];
  
  for (const [key, items] of groups) {
    if (items.length > 1) {
      dupGroups.push({ key, items });
      dupCount += items.length - 1;
    }
  }

  console.log(`Found ${dupGroups.length} groups with duplicates (${dupCount} extra records)\n`);
  console.log('='.repeat(80));

  for (const { key, items } of dupGroups) {
    console.log(`\n[GROUP: "${key}" — ${items.length} records]`);
    for (const item of items) {
      const hasImg = item.image_url ? '✅' : '❌';
      console.log(`  ${hasImg} [${item.id.substring(0, 8)}] "${item.name}"`);
    }
  }

  // Also check: items with no image
  const noImage = rows.filter((r: any) => !r.image_url);
  console.log(`\n${'='.repeat(80)}`);
  console.log(`\nIngredients WITHOUT image: ${noImage.length}`);
  for (const r of noImage) {
    console.log(`  ❌ "${r.name}" [${r.code}]`);
  }

  pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
