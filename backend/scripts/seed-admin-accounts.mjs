/**
 * Seed 3 tài khoản admin cho Mogu:
 * 1. superadmin / SUPER_ADMIN
 * 2. reviewer / REVIEWER
 * 3. contentadmin / CONTENT_ADMIN
 *
 * Chiến lược auth: username → email nội bộ <username>@user.mogu.internal
 */
import pg from 'pg';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const INTERNAL_DOMAIN = 'user.mogu.internal';

const ADMINS = [
  { username: 'superadmin', password: 'Admin@Mogu2026!', displayName: 'Super Admin', role: 'SUPER_ADMIN' },
  { username: 'reviewer1', password: 'Reviewer@2026!', displayName: 'Reviewer', role: 'REVIEWER' },
  { username: 'contentadmin', password: 'Content@2026!', displayName: 'Content Admin', role: 'CONTENT_ADMIN' },
];

const authHeaders = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

async function ensureSupabaseUser(username, password) {
  const email = `${username}@${INTERNAL_DOMAIN}`;

  // Thử tạo mới
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const data = await res.json();

  if (res.ok) {
    console.log(`  ✓ Supabase user tạo: ${email} → id: ${data.id}`);
    return data.id;
  }

  // Đã tồn tại → tìm theo email
  const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, { headers: authHeaders });
  const listData = await listRes.json();
  const existing = listData.users?.find(u => u.email === email);
  if (existing) {
    console.log(`  ↳ User đã tồn tại: ${email} → id: ${existing.id}`);
    return existing.id;
  }

  throw new Error(`Tạo user thất bại: ${JSON.stringify(data)}`);
}

async function main() {
  const client = new pg.Client({ connectionString: process.env.DIRECT_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('🔑 Seeding 3 admin accounts...\n');

  for (const admin of ADMINS) {
    console.log(`\n── ${admin.username} (${admin.role}) ──`);

    // 1. Tạo Supabase Auth user
    const userId = await ensureSupabaseUser(admin.username, admin.password);

    // 2. Upsert profile
    const profileResult = await client.query(`
      INSERT INTO profiles (user_id, display_name, account_status, onboarding_status, onboarding_step)
      VALUES ($1::uuid, $2, 'ACTIVE', 'COMPLETED', 99)
      ON CONFLICT (user_id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        account_status = 'ACTIVE',
        onboarding_status = 'COMPLETED',
        onboarding_step = 99
      RETURNING id
    `, [userId, admin.displayName]);
    const profileId = profileResult.rows[0].id;
    console.log(`  ✓ Profile: ${profileId}`);

    // 3. Upsert account (username table)
    await client.query(`
      INSERT INTO accounts (username, password_hash, must_change_password)
      VALUES ($1, $2, false)
      ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
    `, [admin.username, userId]); // password_hash = supabase userId (placeholder)
    console.log(`  ✓ Account: ${admin.username}`);

    // 4. Gán role
    await client.query(`
      INSERT INTO profile_roles (profile_id, role, assigned_by)
      VALUES ($1::uuid, $2::system_role, $1::uuid)
      ON CONFLICT (profile_id, role) DO NOTHING
    `, [profileId, admin.role]);
    console.log(`  ✓ Role: ${admin.role}`);
  }

  console.log('\n\n════════════════════════════════════════════');
  console.log('  ✅ Seed admin accounts hoàn tất!');
  console.log('════════════════════════════════════════════');
  console.log('  SUPER_ADMIN    : superadmin / Admin@Mogu2026!');
  console.log('  REVIEWER       : reviewer1 / Reviewer@2026!');
  console.log('  CONTENT_ADMIN  : contentadmin / Content@2026!');
  console.log('  Admin UI       : http://localhost:5173');
  console.log('════════════════════════════════════════════');

  await client.end();
}

main().catch(e => {
  console.error('❌ Lỗi:', e.message);
  process.exit(1);
});
