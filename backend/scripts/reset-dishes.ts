/**
 * reset-dishes.ts
 * Phase 1: Xóa toàn bộ data món ăn + drop bảng cũ không cần
 * Chạy: npx ts-node --esm scripts/reset-dishes.ts
 * Hoặc: npx tsx scripts/reset-dishes.ts
 */
import pg from 'pg'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

// Dùng direct PG (không qua pgbouncer) để chạy DDL
const DATABASE_URL = process.env.DATABASE_URL!
  // Đổi sang direct connection (port 5432) thay vì pooler (6543)
  .replace(':6543/', ':5432/')
  .replace('pgbouncer=true&', '')
  .replace('&pgbouncer=true', '')
  .replace('connection_limit=1', '')

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function run(label: string, query: string) {
  process.stdout.write(`  ▶ ${label}... `)
  try {
    await client.query(query)
    console.log('✅')
  } catch (err: any) {
    console.log(`⚠️  ${err.message?.substring(0, 120)}`)
  }
}

async function main() {
  await client.connect()
  console.log('🗑️  RESET DISHES DB\n')

  // ── Tắt triggers tạm (tránh conflict) ───────────────────────────────────
  await run('Tắt triggers', `SET session_replication_role = 'replica';`)

  // ── Xóa data các bảng phụ (FK order) ────────────────────────────────────
  const TRUNCATE_TABLES = [
    'dish_media',
    'dish_audit_logs',
    'dish_versions',
    'field_evidence',
    'import_jobs',
    'recipe_steps',
    'recipes',
    'nutrition_profiles',
    'dish_ingredients',
    'dish_allergens',
    'dish_sources',
    'dish_goals',
    'dish_diet_types',
    'dish_meal_types',
    'dish_category_links',
    'saved_dishes',
    'random_histories',
    'recommendation_logs',
    'dish_randomizations',
    'dishes',
    'ingredients',
  ]

  for (const table of TRUNCATE_TABLES) {
    await run(`TRUNCATE ${table}`, `TRUNCATE TABLE ${table} CASCADE;`)
  }

  // ── Bật lại triggers ─────────────────────────────────────────────────────
  await run('Bật lại triggers', `SET session_replication_role = 'origin';`)

  // ── Drop bảng cũ không cần nữa ──────────────────────────────────────────
  console.log('\n🗑️  DROP các bảng cũ không cần thiết...\n')

  const DROP_TABLES = [
    { table: 'import_jobs',        reason: 'Pipeline import phức tạp — không dùng' },
    { table: 'field_evidence',     reason: 'Evidence tracking — không dùng' },
    { table: 'dish_sources',       reason: 'Source tracking — không dùng' },
    { table: 'dish_versions',      reason: 'Version history — không dùng' },
    { table: 'dish_audit_logs',    reason: 'Audit log — không dùng' },
    { table: 'recipes',            reason: 'Thay bằng recipe_steps link thẳng dish_id' },
    { table: 'nutrition_profiles', reason: 'Thay bằng dish_nutrition (1-1)' },
  ]

  for (const { table, reason } of DROP_TABLES) {
    await run(`DROP ${table} (${reason})`, `DROP TABLE IF EXISTS ${table} CASCADE;`)
  }

  // ── Drop enums không dùng nữa ───────────────────────────────────────────
  console.log('\n🗑️  DROP enums cũ...\n')
  const DROP_ENUMS = [
    '"ImportJobStatus"',
    '"ImportSourceType"',
    '"NutritionMethod"',
    '"ReviewReasonCode"',
  ]
  for (const e of DROP_ENUMS) {
    await run(`DROP ENUM ${e}`, `DROP TYPE IF EXISTS ${e} CASCADE;`)
  }

  console.log('\n✅ Reset hoàn tất! DB sạch sẵn sàng migrate schema mới.\n')
  await client.end()
}

main().catch(async (err) => {
  console.error('❌ Fatal:', err)
  await client.end()
  process.exit(1)
})
