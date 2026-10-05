import 'dotenv/config';
import { config } from 'dotenv';
import pg from 'pg';
config({ path: '.env.local', override: true });

const c = new pg.Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
await c.connect();
const r = await c.query(
  `SELECT id, result_status, model, latency_ms, created_at, extraction->>'primaryName' AS name
   FROM food_scan_events ORDER BY created_at DESC LIMIT 25`,
);
for (const row of r.rows)
  console.log(row.created_at.toISOString(), '|', row.result_status, '|', row.name, '|', `${row.latency_ms}ms`, '|', row.model);
await c.end();
