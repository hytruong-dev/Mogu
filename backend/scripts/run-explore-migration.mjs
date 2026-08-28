import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Running explore migration via Supabase...');
console.log('URL:', supabaseUrl);

// Read the SQL file
const sql = readFileSync(join(__dirname, 'migrate-explore.sql'), 'utf-8');

// Use the Supabase REST SQL endpoint (only available with service role)
const response = await fetch(`${supabaseUrl}/rest/v1/`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Prefer': 'return=minimal'
  }
});

// Use pg directly via connection string
const { default: pg } = await import('pg');
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const client = await pool.connect();

// Split SQL into individual statements, handling $$ blocks
const statements = [];
let current = '';
let inDollarBlock = false;

for (const line of sql.split('\n')) {
  if (line.trim().startsWith('--')) {
    continue; // skip comment lines
  }
  const dollarMatches = (line.match(/\$\$/g) || []).length;
  if (dollarMatches % 2 !== 0) {
    inDollarBlock = !inDollarBlock;
  }
  current += line + '\n';
  if (!inDollarBlock && current.trimEnd().endsWith(';')) {
    const stmt = current.trim();
    if (stmt.length > 1) statements.push(stmt);
    current = '';
  }
}
if (current.trim().length > 0) statements.push(current.trim());

console.log(`\nExecuting ${statements.length} statements...\n`);

let ok = 0;
let failed = 0;

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  const preview = stmt.replace(/\s+/g, ' ').slice(0, 100);
  try {
    await client.query(stmt);
    console.log(`  ✅ [${i + 1}] ${preview}`);
    ok++;
  } catch (err) {
    console.error(`  ❌ [${i + 1}] ${preview}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

client.release();
await pool.end();

console.log(`\nDone: ${ok} succeeded, ${failed} failed`);
