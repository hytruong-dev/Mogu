import pg from 'pg';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

const client = new pg.Client({ connectionString: process.env.DIRECT_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const r = await client.query(`SELECT unnest(enum_range(NULL::system_role))::text as val`);
console.log('system_role enum values:', r.rows.map(x => x.val));

const r2 = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('accounts','profile_roles','dishes') ORDER BY table_name`);
console.log('Tables:', r2.rows.map(x => x.table_name));

await client.end();
