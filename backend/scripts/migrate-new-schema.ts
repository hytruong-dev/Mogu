/**
 * migrate-new-schema.ts
 * Phase 2: Tạo schema mới cho món ăn (đơn giản hóa)
 *
 * Thay đổi so với BA-004 cũ:
 * - ingredients: thêm image_url, image_key
 * - recipe_steps: link thẳng dish_id (đã drop recipes table)
 * - dish_nutrition: tạo mới (1-1, thay nutrition_profiles)
 * - reviews: tạo mới
 * - dishes: thêm rating_avg, rating_count, primary_meal_slot
 */
import pg from 'pg'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const DATABASE_URL = (process.env.DATABASE_URL ?? '')
  .replace(':6543/', ':5432/')
  .replace('pgbouncer=true&', '')
  .replace('&pgbouncer=true', '')
  .replace('connection_limit=1', '')
  .replace(/&&+/, '&')
  .replace(/\?&/, '?')
  .replace(/&$/, '')

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })

async function run(label: string, query: string) {
  process.stdout.write(`  ▶ ${label}... `)
  try {
    await client.query(query)
    console.log('✅')
  } catch (err: any) {
    console.log(`⚠️  ${err.message?.substring(0, 200)}`)
  }
}

async function main() {
  await client.connect()
  console.log('🏗️  MIGRATE NEW SCHEMA\n')

  // ── 1. Cập nhật bảng ingredients: thêm image_url, image_key ────────────
  console.log('\n[1] Cập nhật bảng ingredients...')
  await run('Thêm image_url', `
    ALTER TABLE ingredients
      ADD COLUMN IF NOT EXISTS image_url  TEXT,
      ADD COLUMN IF NOT EXISTS image_key  VARCHAR(500);
  `)

  // ── 2. Cập nhật recipe_steps: thêm dish_id, bỏ recipe_id ───────────────
  console.log('\n[2] Cập nhật recipe_steps (link thẳng dish_id)...')
  await run('Thêm dish_id vào recipe_steps', `
    ALTER TABLE recipe_steps
      ADD COLUMN IF NOT EXISTS dish_id UUID REFERENCES dishes(id) ON DELETE CASCADE;
  `)
  await run('Xóa constraint recipe_id nếu còn', `
    ALTER TABLE recipe_steps DROP COLUMN IF EXISTS recipe_id;
  `)
  await run('Thêm index dish_id', `
    CREATE INDEX IF NOT EXISTS idx_recipe_steps_dish_id ON recipe_steps(dish_id);
  `)
  await run('Unique constraint (dish_id, step_order)', `
    ALTER TABLE recipe_steps DROP CONSTRAINT IF EXISTS recipe_steps_recipe_id_step_order_key;
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'recipe_steps_dish_id_step_order_key'
      ) THEN
        ALTER TABLE recipe_steps
          ADD CONSTRAINT recipe_steps_dish_id_step_order_key UNIQUE (dish_id, step_order);
      END IF;
    END $$;
  `)

  // ── 3. Tạo bảng dish_nutrition (1-1 per dish) ───────────────────────────
  console.log('\n[3] Tạo bảng dish_nutrition...')
  await run('CREATE dish_nutrition', `
    CREATE TABLE IF NOT EXISTS dish_nutrition (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dish_id      UUID UNIQUE NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
      calories     NUMERIC(8,2),
      protein_g    NUMERIC(8,2),
      carbs_g      NUMERIC(8,2),
      fat_g        NUMERIC(8,2),
      fiber_g      NUMERIC(8,2),
      sodium_mg    NUMERIC(8,2),
      serving_name VARCHAR(100)   DEFAULT '1 phần',
      serving_g    NUMERIC(8,2),
      created_at   TIMESTAMPTZ    DEFAULT now(),
      updated_at   TIMESTAMPTZ    DEFAULT now()
    );
  `)
  await run('INDEX dish_nutrition.dish_id', `
    CREATE INDEX IF NOT EXISTS idx_dish_nutrition_dish_id ON dish_nutrition(dish_id);
  `)

  // ── 3b. Tạo bảng dish_sources (nguồn tham khảo món) ─────────────────────
  console.log('\n[3b] Tạo bảng dish_sources...')
  await run('enum import_source_type', `
    DO $$ BEGIN
      CREATE TYPE import_source_type AS ENUM ('JSON_LD', 'VIDEO', 'NUTRITION', 'UNSTRUCTURED');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
  await run('CREATE dish_sources', `
    CREATE TABLE IF NOT EXISTS dish_sources (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dish_id     UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
      url         TEXT NOT NULL,
      domain      VARCHAR(200),
      title       VARCHAR(300),
      author      VARCHAR(200),
      source_type import_source_type NOT NULL DEFAULT 'UNSTRUCTURED',
      reliability INT NOT NULL DEFAULT 50 CHECK (reliability BETWEEN 0 AND 100),
      accessed_at TIMESTAMPTZ,
      is_stale    BOOLEAN NOT NULL DEFAULT false,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
  await run('INDEX dish_sources.dish_id', `
    CREATE INDEX IF NOT EXISTS ds_dish_id_idx ON dish_sources(dish_id);
  `)

  // ── 4. Cập nhật dishes: thêm rating_avg, rating_count, primary_meal_slot ─
  console.log('\n[4] Cập nhật bảng dishes...')
  await run('Thêm rating_avg, rating_count, primary_meal_slot', `
    ALTER TABLE dishes
      ADD COLUMN IF NOT EXISTS rating_avg         NUMERIC(3,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS rating_count        INT          DEFAULT 0,
      ADD COLUMN IF NOT EXISTS primary_meal_slot   VARCHAR(50);
  `)

  // ── 5. Tạo bảng reviews ─────────────────────────────────────────────────
  console.log('\n[5] Tạo bảng reviews...')
  await run('CREATE reviews', `
    CREATE TABLE IF NOT EXISTS reviews (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dish_id     UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
      user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      rating      SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment     TEXT,
      is_visible  BOOLEAN DEFAULT true,
      created_at  TIMESTAMPTZ DEFAULT now(),
      updated_at  TIMESTAMPTZ DEFAULT now(),
      UNIQUE (dish_id, user_id)
    );
  `)
  await run('INDEX reviews.dish_id', `
    CREATE INDEX IF NOT EXISTS idx_reviews_dish_id ON reviews(dish_id);
  `)
  await run('INDEX reviews.user_id', `
    CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
  `)

  // ── 6. Trigger cập nhật rating_avg sau khi insert/update/delete review ──
  console.log('\n[6] Tạo trigger cập nhật rating...')
  await run('Tạo function update_dish_rating', `
    CREATE OR REPLACE FUNCTION update_dish_rating()
    RETURNS TRIGGER AS $$
    BEGIN
      UPDATE dishes
      SET
        rating_avg   = (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE dish_id = COALESCE(NEW.dish_id, OLD.dish_id) AND is_visible = true),
        rating_count = (SELECT COUNT(*) FROM reviews WHERE dish_id = COALESCE(NEW.dish_id, OLD.dish_id) AND is_visible = true),
        updated_at   = now()
      WHERE id = COALESCE(NEW.dish_id, OLD.dish_id);
      RETURN COALESCE(NEW, OLD);
    END;
    $$ LANGUAGE plpgsql;
  `)
  await run('DROP cũ trigger nếu có', `DROP TRIGGER IF EXISTS trg_update_dish_rating ON reviews;`)
  await run('Tạo trigger reviews', `
    CREATE TRIGGER trg_update_dish_rating
    AFTER INSERT OR UPDATE OR DELETE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_dish_rating();
  `)

  // ── 7. Trigger updated_at cho dish_nutrition ────────────────────────────
  await run('Trigger updated_at dish_nutrition', `
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = now(); RETURN NEW; END;
    $$ LANGUAGE plpgsql;
  `)
  await run('DROP trigger dish_nutrition', `DROP TRIGGER IF EXISTS trg_dish_nutrition_updated_at ON dish_nutrition;`)
  await run('Tạo trigger dish_nutrition updated_at', `
    CREATE TRIGGER trg_dish_nutrition_updated_at
    BEFORE UPDATE ON dish_nutrition
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `)
  await run('DROP trigger reviews', `DROP TRIGGER IF EXISTS trg_reviews_updated_at ON reviews;`)
  await run('Tạo trigger reviews updated_at', `
    CREATE TRIGGER trg_reviews_updated_at
    BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `)

  console.log('\n✅ Migration schema mới hoàn tất!\n')
  await client.end()
}

main().catch(async (err) => {
  console.error('❌ Fatal:', err)
  await client.end()
  process.exit(1)
})
