/**
 * BA-006 Migration: Mở rộng RandomHistory + RandomCandidate + RecommendationEvent
 */
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const sql = `
-- ══════════════════════════════════════════════════════════════════
-- BA-006: Enums
-- ══════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE randomization_status AS ENUM ('PROCESSING','COMPLETED','NO_CANDIDATE','CANCELLED','FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE recommendation_source AS ENUM ('RANDOM_FLOW','RANDOM_AGAIN','HOME_QUICK_RANDOM','WEEKLY_PLAN_SWAP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE meal_selection_source AS ENUM ('AUTO_TIME','USER_SELECTED','PROFILE_DEFAULT','SYSTEM_DEFAULT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE budget_mode AS ENUM ('EXPLICIT_RANGE','ECONOMY_PROFILE','PROFILE_DEFAULT','UNLIMITED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE recommendation_event_type AS ENUM (
    'IMPRESSION','OPEN_DETAIL','SELECT','RETRY','SAVE','SHARE',
    'DISLIKE','NOT_RELEVANT','TOO_EXPENSIVE','TOO_FAR','ALLERGY_CONCERN','DISMISS'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ══════════════════════════════════════════════════════════════════
-- BA-006: Mở rộng random_histories (additive - không drop dữ liệu cũ)
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE random_histories
  ADD COLUMN IF NOT EXISTS session_id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS previous_randomization_id UUID,
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100),
  ADD COLUMN IF NOT EXISTS status randomization_status NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN IF NOT EXISTS source recommendation_source NOT NULL DEFAULT 'RANDOM_FLOW',
  ADD COLUMN IF NOT EXISTS attempt_no INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS meal_slot VARCHAR(20),
  ADD COLUMN IF NOT EXISTS meal_selection_source meal_selection_source NOT NULL DEFAULT 'AUTO_TIME',
  ADD COLUMN IF NOT EXISTS budget_mode budget_mode NOT NULL DEFAULT 'UNLIMITED',
  ADD COLUMN IF NOT EXISTS budget_min_vnd INT,
  ADD COLUMN IF NOT EXISTS budget_max_vnd INT,
  ADD COLUMN IF NOT EXISTS profile_version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS profile_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS fallback_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS random_seed VARCHAR(64),
  ADD COLUMN IF NOT EXISTS candidate_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_ms INT,
  ADD COLUMN IF NOT EXISTS total_score DECIMAL(6,3),
  ADD COLUMN IF NOT EXISTS compatibility_percent INT,
  ADD COLUMN IF NOT EXISTS fail_reason_code VARCHAR(64),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Đổi algorithm_version default
ALTER TABLE random_histories
  ALTER COLUMN algorithm_version SET DEFAULT 'rule-v2.0.0';

-- Unique constraint (userId, idempotencyKey)
DO $$ BEGIN
  ALTER TABLE random_histories ADD CONSTRAINT random_histories_user_idempotency_key UNIQUE (user_id, idempotency_key);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

-- Indexes mới
CREATE INDEX IF NOT EXISTS idx_random_histories_user_created
  ON random_histories (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_random_histories_session_attempt
  ON random_histories (session_id, attempt_no);
CREATE INDEX IF NOT EXISTS idx_random_histories_dish_created
  ON random_histories (dish_id, created_at DESC);

-- ══════════════════════════════════════════════════════════════════
-- BA-006: RandomCandidate
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS random_candidates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  random_history_id UUID NOT NULL REFERENCES random_histories(id) ON DELETE CASCADE,
  dish_id           UUID NOT NULL REFERENCES dishes(id) ON DELETE RESTRICT,
  rank              INT NOT NULL,
  total_score       DECIMAL(6,3) NOT NULL,
  sampling_weight   DECIMAL(12,8) NOT NULL DEFAULT 0,
  score_breakdown   JSONB NOT NULL DEFAULT '{}',
  is_chosen         BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (random_history_id, dish_id)
);

CREATE INDEX IF NOT EXISTS idx_random_candidates_history_rank
  ON random_candidates (random_history_id, rank);

-- ══════════════════════════════════════════════════════════════════
-- BA-006: RecommendationEvent
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS recommendation_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL,
  random_history_id UUID REFERENCES random_histories(id) ON DELETE SET NULL,
  dish_id           UUID REFERENCES dishes(id) ON DELETE SET NULL,
  event_type        recommendation_event_type NOT NULL,
  reason_code       VARCHAR(64),
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recommendation_events_user_created
  ON recommendation_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommendation_events_user_dish_created
  ON recommendation_events (user_id, dish_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommendation_events_history
  ON recommendation_events (random_history_id);

-- ══════════════════════════════════════════════════════════════════
-- BA-006: Indexes cho dish lookup (query performance)
-- ══════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_dishes_published_random
  ON dishes (id, price_max, rating_avg)
  WHERE status = 'PUBLISHED' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_dish_meal_types_lookup
  ON dish_meal_types (meal_type_tag_id, dish_id);

CREATE INDEX IF NOT EXISTS idx_dish_allergens_lookup
  ON dish_allergens (allergen_id, level, dish_id);

-- updated_at trigger cho random_histories
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_random_histories_updated_at ON random_histories;
CREATE TRIGGER trg_random_histories_updated_at
  BEFORE UPDATE ON random_histories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
`;

async function main() {
  console.log('🚀 Running BA-006 migration...');
  try {
    await pool.query(sql);
    console.log('✅ Migration completed successfully!');

    // Verify
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('random_histories','random_candidates','recommendation_events')
      ORDER BY table_name
    `);
    console.log('Tables:', tables.rows.map(r => r.table_name));

    const cols = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'random_histories' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('random_histories columns:', cols.rows.map(r => r.column_name).join(', '));
  } catch (e: any) {
    console.error('❌ Migration failed:', e.message);
    process.exit(1);
  }
  await pool.end();
}
main();
