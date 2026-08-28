/**
 * Script tạo tài khoản Admin cho Mogu
 * - Tạo Auth user qua Supabase Admin API
 * - Tạo profile trong bảng profiles (đã tồn tại)
 * - Tạo bảng profile_roles nếu chưa có, rồi gán SUPER_ADMIN
 *
 * Usage: npx tsx scripts/create-admin.ts
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const ADMIN_EMAIL = 'admin@mogu.vn'
const ADMIN_PASSWORD = 'Admin@Mogu2026!'
const ADMIN_DISPLAY_NAME = 'Admin Mogu'

const authHeaders = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
}

async function ensureAuthUser(): Promise<string> {
  console.log(`\n[1/4] Tạo/kiểm tra Auth user: ${ADMIN_EMAIL}...`)

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    }),
  })
  const data = await res.json()

  if (res.ok) {
    console.log(`  ✓ Auth user tạo thành công — id: ${data.id}`)
    return data.id as string
  }

  // Đã tồn tại → tìm trong danh sách
  const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, { headers: authHeaders })
  const listData = await listRes.json()
  const existing = listData.users?.find((u: { email: string }) => u.email === ADMIN_EMAIL)
  if (!existing) throw new Error(`Tạo user thất bại và không tìm thấy: ${JSON.stringify(data)}`)
  console.log(`  ↳ User đã tồn tại — id: ${existing.id}`)
  return existing.id as string
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! })
  const prisma = new PrismaClient({ adapter })

  console.log('═══════════════════════════════════════════')
  console.log('  Mogu Admin — Tạo tài khoản SUPER_ADMIN')
  console.log('═══════════════════════════════════════════')

  try {
    const userId = await ensureAuthUser()

    // ── Profile ──────────────────────────────────────────────────────────────
    console.log('\n[2/4] Kiểm tra/tạo Profile...')

    // Dùng raw SQL vì schema Prisma chưa sync hoàn toàn
    const existing = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM profiles WHERE user_id = ${userId}::uuid LIMIT 1
    `

    let profileId: string
    if (existing.length > 0) {
      profileId = existing[0].id
      console.log(`  ↳ Profile đã tồn tại — id: ${profileId}`)
      // Cập nhật account_status → ACTIVE
      await prisma.$executeRaw`
        UPDATE profiles 
        SET account_status = 'ACTIVE', onboarding_status = 'COMPLETED', onboarding_step = 99
        WHERE id = ${profileId}::uuid
      `
    } else {
      const created = await prisma.$queryRaw<{ id: string }[]>`
        INSERT INTO profiles (user_id, display_name, account_status, onboarding_status, onboarding_step)
        VALUES (${userId}::uuid, ${ADMIN_DISPLAY_NAME}, 'ACTIVE', 'COMPLETED', 99)
        RETURNING id
      `
      profileId = created[0].id
      console.log(`  ✓ Profile tạo thành công — id: ${profileId}`)
    }

    // ── Tạo bảng profile_roles nếu chưa có ───────────────────────────────────
    console.log('\n[3/4] Kiểm tra bảng profile_roles...')
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS profile_roles (
        profile_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        role        TEXT        NOT NULL,
        assigned_by UUID,
        assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (profile_id, role)
      )
    `
    console.log('  ✓ Bảng profile_roles sẵn sàng')

    // ── Gán SUPER_ADMIN ───────────────────────────────────────────────────────
    console.log('\n[4/4] Gán role SUPER_ADMIN...')
    await prisma.$executeRaw`
      INSERT INTO profile_roles (profile_id, role, assigned_by)
      VALUES (${profileId}::uuid, 'SUPER_ADMIN', ${profileId}::uuid)
      ON CONFLICT (profile_id, role) DO NOTHING
    `
    console.log('  ✓ Role SUPER_ADMIN đã gán')

    console.log('\n═══════════════════════════════════════════')
    console.log('  ✅ HOÀN THÀNH!')
    console.log('═══════════════════════════════════════════')
    console.log(`  Email    : ${ADMIN_EMAIL}`)
    console.log(`  Password : ${ADMIN_PASSWORD}`)
    console.log(`  Role     : SUPER_ADMIN`)
    console.log(`  Admin UI : http://localhost:5173`)
    console.log('═══════════════════════════════════════════')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('\n❌ Lỗi:', err.message)
  process.exit(1)
})
