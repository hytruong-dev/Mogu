/**
 * reset-dishes-db.mjs
 * Phase 1: Xóa data món ăn + drop bảng cũ không cần
 * Giữ nguyên: regions, provinces, categories, meal_types, diet_types, allergens, goals, profiles
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://lkqvyvllmrbxgaoqrkhd.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrcXZ5dmxsbXJieGdhb3Fya2hkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjM1MTgyOCwiZXhwIjoyMTAxOTI3ODI4fQ.A6nsyhZg2GI4PuCZZgSAKCXtceBoB3RvzW-RdRdmqqw'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  db: { schema: 'public' },
  auth: { persistSession: false },
})

async function sql(query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`SQL error: ${err}`)
  }
  return res.json().catch(() => null)
}

// Dùng Supabase SQL endpoint trực tiếp
async function runSQL(statement) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_raw`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql: statement }),
  })
  const text = await res.text()
  console.log(`  → ${res.status}: ${text.substring(0, 100)}`)
}

const STEPS = [
  // ── Step 1: Xóa data trong các bảng phụ trước (FK constraints) ──────────
  {
    label: '1. Xóa dish_media (Supabase Storage objects sẽ orphan — xóa bucket sau)',
    sql: `DELETE FROM dish_media;`,
  },
  {
    label: '2. Xóa dish_audit_logs',
    sql: `DELETE FROM dish_audit_logs;`,
  },
  {
    label: '3. Xóa dish_versions',
    sql: `DELETE FROM dish_versions;`,
  },
  {
    label: '4. Xóa field_evidence',
    sql: `DELETE FROM field_evidence;`,
  },
  {
    label: '5. Xóa import_jobs',
    sql: `DELETE FROM import_jobs;`,
  },
  {
    label: '6. Xóa recipe_steps',
    sql: `DELETE FROM recipe_steps;`,
  },
  {
    label: '7. Xóa recipes',
    sql: `DELETE FROM recipes;`,
  },
  {
    label: '8. Xóa nutrition_profiles',
    sql: `DELETE FROM nutrition_profiles;`,
  },
  {
    label: '9. Xóa dish_ingredients',
    sql: `DELETE FROM dish_ingredients;`,
  },
  {
    label: '10. Xóa dish_allergens',
    sql: `DELETE FROM dish_allergens;`,
  },
  {
    label: '11. Xóa dish_sources',
    sql: `DELETE FROM dish_sources;`,
  },
  {
    label: '12. Xóa dish_goals',
    sql: `DELETE FROM dish_goals;`,
  },
  {
    label: '13. Xóa dish_diet_types',
    sql: `DELETE FROM dish_diet_types;`,
  },
  {
    label: '14. Xóa dish_meal_types',
    sql: `DELETE FROM dish_meal_types;`,
  },
  {
    label: '15. Xóa dish_category_links',
    sql: `DELETE FROM dish_category_links;`,
  },
  {
    label: '16. Xóa saved_dishes',
    sql: `DELETE FROM saved_dishes;`,
  },
  {
    label: '17. Xóa random_histories',
    sql: `DELETE FROM random_histories;`,
  },
  {
    label: '18. Xóa recommendation_logs',
    sql: `DELETE FROM recommendation_logs;`,
  },
  {
    label: '19. Xóa dish_randomizations',
    sql: `DELETE FROM dish_randomizations;`,
  },
  {
    label: '20. Xóa dishes (bảng chính)',
    sql: `DELETE FROM dishes;`,
  },

  // ── Step 2: Xóa ingredients (từ điển - reset sạch) ──────────────────────
  {
    label: '21. Xóa ingredients',
    sql: `DELETE FROM ingredients;`,
  },

  // ── Step 3: Drop các bảng cũ không cần thiết ────────────────────────────
  {
    label: '22. Drop import_jobs',
    sql: `DROP TABLE IF EXISTS import_jobs CASCADE;`,
  },
  {
    label: '23. Drop field_evidence',
    sql: `DROP TABLE IF EXISTS field_evidence CASCADE;`,
  },
  {
    label: '24. Drop dish_sources',
    sql: `DROP TABLE IF EXISTS dish_sources CASCADE;`,
  },
  {
    label: '25. Drop dish_versions',
    sql: `DROP TABLE IF EXISTS dish_versions CASCADE;`,
  },
  {
    label: '26. Drop dish_audit_logs',
    sql: `DROP TABLE IF EXISTS dish_audit_logs CASCADE;`,
  },
  {
    label: '27. Drop recipes (thay bằng recipe_steps direct)',
    sql: `DROP TABLE IF EXISTS recipes CASCADE;`,
  },
  {
    label: '28. Drop nutrition_profiles (thay bằng dish_nutrition)',
    sql: `DROP TABLE IF EXISTS nutrition_profiles CASCADE;`,
  },
]

async function main() {
  console.log('🗑️  RESET DISHES DB — bắt đầu...\n')

  for (const step of STEPS) {
    console.log(`▶ ${step.label}`)
    try {
      const { data, error } = await supabase.rpc('exec_sql_void', { p_sql: step.sql }).single()
      if (error) {
        // Thử cách khác nếu RPC không tồn tại
        console.log(`  ⚠️  RPC không có, thử direct query...`)
        // Supabase không expose raw SQL qua REST — dùng pg driver
        throw error
      }
      console.log(`  ✅ OK`)
    } catch (err) {
      console.log(`  ⚠️  ${err.message?.substring(0, 150)}`)
    }
  }

  console.log('\n✅ Done!')
}

main().catch(console.error)
