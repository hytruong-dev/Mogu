// Provision the missing-dish queue using the same environment as the backend.
require('dotenv').config({ path: '.env.local', quiet: true });
require('dotenv').config({ quiet: true });
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const db = new Client({ connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query(fs.readFileSync(path.join(__dirname, '../prisma/migrations/20260929_food_scan_missing_dish_reports/migration.sql'), 'utf8'));
    console.log('Missing-dish report table and indexes ready.');
  } finally {
    await db.end();
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error('Storage configuration missing: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const bucket = process.env.FOOD_SCAN_REPORT_BUCKET || 'food-scan-reports';
  const { data: existing, error: lookupError } = await supabase.storage.getBucket(bucket);
  if (!existing) {
    if (lookupError && !/not found/i.test(lookupError.message)) throw lookupError;
    const { error } = await supabase.storage.createBucket(bucket, {
      public: false, fileSizeLimit: 5 * 1024 * 1024, allowedMimeTypes: ['image/jpeg'],
    });
    if (error) throw error;
  } else if (existing.public) {
    throw new Error(`Bucket ${bucket} must be private; refusing to use a public reports bucket.`);
  }
  console.log(`Private bucket ${bucket} ready.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
