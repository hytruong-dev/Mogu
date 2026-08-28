/**
 * Script tạo tài khoản Admin cho Mogu
 * Usage: node scripts/create-admin.mjs
 */

const SUPABASE_URL = 'https://lkqvyvllmrbxgaoqrkhd.supabase.co'
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrcXZ5dmxsbXJieGdhb3Fya2hkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjM1MTgyOCwiZXhwIjoyMTAxOTI3ODI4fQ.A6nsyhZg2GI4PuCZZgSAKCXtceBoB3RvzW-RdRdmqqw'
const DATABASE_URL =
  'postgresql://postgres.lkqvyvllmrbxgaoqrkhd:Quanghy%401320012918@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'

const ADMIN_EMAIL = 'admin@mogu.vn'
const ADMIN_PASSWORD = 'Admin@Mogu2026!'
const ADMIN_FULL_NAME = 'Admin Mogu'

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
}

// ── Bước 1: Tạo user trong Supabase Auth ─────────────────────────────────────
async function createAuthUser() {
  console.log(`\n[1/4] Tạo Auth user: ${ADMIN_EMAIL}...`)

  // Thử tạo mới
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true, // bỏ qua email verification
      user_metadata: { full_name: ADMIN_FULL_NAME },
    }),
  })

  const data = await res.json()

  if (!res.ok) {
    // Nếu đã tồn tại, lấy user hiện có
    if (data.msg?.includes('already') || data.message?.includes('already')) {
      console.log('  ↳ User đã tồn tại, tiếp tục...')
      return await getExistingUser()
    }
    throw new Error(`Tạo Auth user thất bại: ${JSON.stringify(data)}`)
  }

  console.log(`  ✓ Auth user tạo thành công — id: ${data.id}`)
  return data
}

async function getExistingUser() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(ADMIN_EMAIL)}`, {
    headers,
  })
  const data = await res.json()
  const user = data.users?.[0]
  if (!user) throw new Error('Không tìm thấy user hiện có')
  console.log(`  ↳ Tìm thấy user hiện có — id: ${user.id}`)
  return user
}

// ── Bước 2: Tạo/kiểm tra profile ─────────────────────────────────────────────
async function ensureProfile(userId) {
  console.log(`\n[2/4] Kiểm tra/tạo profile cho user_id: ${userId}...`)

  // Check profile đã tồn tại chưa
  const checkRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}&select=id,user_id,full_name`,
    { headers },
  )
  const profiles = await checkRes.json()

  if (profiles.length > 0) {
    console.log(`  ↳ Profile đã tồn tại — id: ${profiles[0].id}`)
    return profiles[0]
  }

  // Tạo profile mới
  const createRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId,
      display_name: ADMIN_FULL_NAME,
      account_status: 'ACTIVE',
      onboarding_status: 'COMPLETED',
      onboarding_step: 99,
    }),
  })

  const created = await createRes.json()
  if (!createRes.ok) throw new Error(`Tạo profile thất bại: ${JSON.stringify(created)}`)

  const profile = Array.isArray(created) ? created[0] : created
  console.log(`  ✓ Profile tạo thành công — id: ${profile.id}`)
  return profile
}

// ── Bước 3: Gán role SUPER_ADMIN ─────────────────────────────────────────────
async function assignSuperAdmin(profileId) {
  console.log(`\n[3/4] Gán role SUPER_ADMIN cho profile_id: ${profileId}...`)

  // Check role đã tồn tại chưa
  const checkRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profile_roles?profile_id=eq.${profileId}&role=eq.SUPER_ADMIN&select=id`,
    { headers },
  )
  const existing = await checkRes.json()

  if (existing.length > 0) {
    console.log('  ↳ Role SUPER_ADMIN đã được gán rồi')
    return
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/profile_roles`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({
      profile_id: profileId,
      role: 'SUPER_ADMIN',
      assigned_by: profileId,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gán role thất bại: ${err}`)
  }

  console.log('  ✓ Role SUPER_ADMIN đã được gán thành công')
}

// ── Bước 4: Verify login ──────────────────────────────────────────────────────
async function verifyLogin() {
  console.log(`\n[4/4] Xác thực đăng nhập...`)

  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })

  const data = await res.json()
  if (!res.ok || !data.access_token) {
    console.warn('  ⚠ Không thể verify login (có thể backend đang tắt). Tài khoản vẫn được tạo.')
    return
  }

  console.log('  ✓ Đăng nhập thành công!')
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  Mogu Admin — Tạo tài khoản SUPER_ADMIN')
  console.log('═══════════════════════════════════════════')

  const user = await createAuthUser()
  const profile = await ensureProfile(user.id)
  await assignSuperAdmin(profile.id)
  await verifyLogin()

  console.log('\n═══════════════════════════════════════════')
  console.log('  ✅ HOÀN THÀNH!')
  console.log('═══════════════════════════════════════════')
  console.log(`  Email    : ${ADMIN_EMAIL}`)
  console.log(`  Password : ${ADMIN_PASSWORD}`)
  console.log(`  Role     : SUPER_ADMIN`)
  console.log(`  URL      : http://localhost:5173`)
  console.log('═══════════════════════════════════════════')
}

main().catch((err) => {
  console.error('\n❌ Lỗi:', err.message)
  process.exit(1)
})
