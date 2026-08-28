-- ─────────────────────────────────────────────────────────────────────────────
-- BA-004: Dish Module Migration
-- Apply via Supabase Dashboard SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Extensions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Rename old enum to avoid conflict with new DishCategory model
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Rename dish_category enum to legacy_dish_category if it exists
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dish_category') THEN
    -- First rename the type
    ALTER TYPE dish_category RENAME TO legacy_dish_category;
    -- Rename the column using it in dishes table if exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dishes' AND column_name = 'category') THEN
      ALTER TABLE dishes ALTER COLUMN category TYPE legacy_dish_category USING category::text::legacy_dish_category;
    END IF;
  END IF;
END $$;

-- 3. New Enums
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE dish_status AS ENUM (
    'DRAFT', 'PROCESSING', 'PENDING_REVIEW', 'CHANGES_REQUESTED',
    'PUBLISHED', 'UNPUBLISHED', 'REJECTED', 'FAILED', 'ARCHIVED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dish_difficulty AS ENUM ('EASY', 'MEDIUM', 'HARD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE allergen_level AS ENUM ('CONTAINS', 'MAY_CONTAIN', 'FREE_FROM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nutrition_method AS ENUM ('SOURCE', 'ESTIMATED', 'COMPUTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE import_job_status AS ENUM (
    'PENDING', 'SEARCHING', 'EXTRACTING', 'NORMALIZING',
    'RECONCILING', 'ENRICHING', 'DONE', 'FAILED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE import_source_type AS ENUM ('JSON_LD', 'VIDEO', 'NUTRITION', 'UNSTRUCTURED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE review_reason_code AS ENUM (
    'INSUFFICIENT_SOURCE', 'CONFLICTING_DATA', 'WRONG_DISH',
    'NUTRITION_RISK', 'ALLERGEN_RISK', 'COPYRIGHT_RISK', 'DUPLICATE', 'CONTENT_QUALITY'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE media_type AS ENUM ('IMAGE', 'VIDEO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE moderation_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE system_role AS ENUM ('USER', 'CONTENT_ADMIN', 'REVIEWER', 'SUPER_ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dish_audit_action AS ENUM (
    'CREATED', 'UPDATED', 'SUBMITTED_REVIEW', 'REQUESTED_CHANGES',
    'APPROVED', 'PUBLISHED', 'UNPUBLISHED', 'REJECTED', 'ARCHIVED',
    'RESTORED', 'ROLLED_BACK', 'IMPORT_STARTED', 'IMPORT_COMPLETED', 'IMPORT_FAILED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. updated_at trigger function
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Taxonomy Tables
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS regions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       VARCHAR(50) UNIQUE NOT NULL,
  name       VARCHAR(100) NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS provinces (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       VARCHAR(50) UNIQUE NOT NULL,
  name       VARCHAR(100) NOT NULL,
  region_id  UUID NOT NULL REFERENCES regions(id) ON DELETE RESTRICT,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS provinces_region_id_idx ON provinces(region_id);

CREATE TABLE IF NOT EXISTS dish_categories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         VARCHAR(50) UNIQUE NOT NULL,
  name         VARCHAR(100) NOT NULL,
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meal_type_tags (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         VARCHAR(50) UNIQUE NOT NULL,
  name         VARCHAR(100) NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS diet_types (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         VARCHAR(50) UNIQUE NOT NULL,
  name         VARCHAR(100) NOT NULL,
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ingredients (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         VARCHAR(100) UNIQUE NOT NULL,
  name         VARCHAR(200) NOT NULL,
  synonyms     TEXT[] NOT NULL DEFAULT '{}',
  unit         VARCHAR(50),
  allergen_code VARCHAR(50),
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ingredients_name_trgm_idx ON ingredients USING gin(name gin_trgm_ops);
DROP TRIGGER IF EXISTS ingredients_updated_at ON ingredients;
CREATE TRIGGER ingredients_updated_at BEFORE UPDATE ON ingredients FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. Dishes table (full BA-004 schema)
-- ─────────────────────────────────────────────────────────────────────────────
-- Drop old simple dishes table if it has the old schema and recreate
-- CAUTION: Only run on fresh/test DB. Production must use expand-and-contract.
DO $$
BEGIN
  -- Check if the old dishes table exists with the old schema (has 'active' column, not 'status')
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dishes' AND column_name = 'active'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dishes' AND column_name = 'status'
  ) THEN
    -- Backup old data if any
    CREATE TABLE IF NOT EXISTS dishes_legacy_backup AS SELECT * FROM dishes;
    DROP TABLE IF EXISTS dishes CASCADE;
    RAISE NOTICE 'Old dishes table backed up to dishes_legacy_backup and dropped.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS dishes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(150) NOT NULL,
  slug              VARCHAR(180) NOT NULL,
  alternate_names   TEXT[] NOT NULL DEFAULT '{}',
  search_text       TEXT NOT NULL DEFAULT '',
  short_description VARCHAR(300),
  full_description  TEXT,
  status            dish_status NOT NULL DEFAULT 'DRAFT',

  region_id         UUID REFERENCES regions(id) ON DELETE RESTRICT,
  province_id       UUID REFERENCES provinces(id) ON DELETE RESTRICT,
  origin_text       VARCHAR(200),
  difficulty        dish_difficulty,
  prep_minutes      SMALLINT CHECK (prep_minutes IS NULL OR prep_minutes >= 0),
  cook_minutes      SMALLINT CHECK (cook_minutes IS NULL OR cook_minutes >= 0),
  servings          DECIMAL(6,2) CHECK (servings IS NULL OR servings > 0),

  price_min         INT CHECK (price_min IS NULL OR price_min >= 0),
  price_max         INT CHECK (price_max IS NULL OR price_max >= price_min),
  currency          CHAR(3) NOT NULL DEFAULT 'VND',
  is_featured       BOOLEAN NOT NULL DEFAULT false,

  parent_dish_id    UUID REFERENCES dishes(id) ON DELETE SET NULL,

  version           INT NOT NULL DEFAULT 1,
  publish_version   INT NOT NULL DEFAULT 0,
  published_at      TIMESTAMPTZ,
  reviewed_at       TIMESTAMPTZ,
  reviewed_by       UUID,
  archived_at       TIMESTAMPTZ,
  deleted_at        TIMESTAMPTZ,

  created_by        UUID,
  updated_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT dishes_no_self_parent CHECK (parent_dish_id IS NULL OR parent_dish_id <> id)
);

-- Slug unique index (partial: exclude soft-deleted)
CREATE UNIQUE INDEX IF NOT EXISTS dishes_slug_active_unique ON dishes(slug) WHERE deleted_at IS NULL;

-- Performance indexes
CREATE INDEX IF NOT EXISTS dishes_status_published_at_idx ON dishes(status, published_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS dishes_region_province_idx ON dishes(region_id, province_id);
CREATE INDEX IF NOT EXISTS dishes_parent_dish_id_idx ON dishes(parent_dish_id);
CREATE INDEX IF NOT EXISTS dishes_search_text_trgm_idx ON dishes USING gin(search_text gin_trgm_ops);

DROP TRIGGER IF EXISTS dishes_updated_at ON dishes;
CREATE TRIGGER dishes_updated_at BEFORE UPDATE ON dishes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 7. Junction Tables
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dish_category_links (
  dish_id     UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES dish_categories(id) ON DELETE RESTRICT,
  PRIMARY KEY (dish_id, category_id)
);
CREATE INDEX IF NOT EXISTS dcl_category_idx ON dish_category_links(category_id);

CREATE TABLE IF NOT EXISTS dish_meal_types (
  dish_id          UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  meal_type_tag_id UUID NOT NULL REFERENCES meal_type_tags(id) ON DELETE RESTRICT,
  PRIMARY KEY (dish_id, meal_type_tag_id)
);
CREATE INDEX IF NOT EXISTS dmt_tag_idx ON dish_meal_types(meal_type_tag_id);

CREATE TABLE IF NOT EXISTS dish_diet_types (
  dish_id      UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  diet_type_id UUID NOT NULL REFERENCES diet_types(id) ON DELETE RESTRICT,
  PRIMARY KEY (dish_id, diet_type_id)
);

-- Add dish_goals relation columns to goals table junction
CREATE TABLE IF NOT EXISTS dish_goals (
  dish_id UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  score   INT NOT NULL DEFAULT 50 CHECK (score BETWEEN 0 AND 100),
  PRIMARY KEY (dish_id, goal_id)
);
CREATE INDEX IF NOT EXISTS dg_goal_score_idx ON dish_goals(goal_id, score);

-- 8. Dish Ingredients
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dish_ingredients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id       UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
  raw_text      VARCHAR(200) NOT NULL,
  quantity      DECIMAL(10,3) CHECK (quantity IS NULL OR quantity >= 0),
  unit          VARCHAR(50),
  preparation   VARCHAR(100),
  is_optional   BOOLEAN NOT NULL DEFAULT false,
  group_label   VARCHAR(100),
  sort_order    INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS di_dish_id_idx ON dish_ingredients(dish_id);
CREATE INDEX IF NOT EXISTS di_ingredient_id_idx ON dish_ingredients(ingredient_id);

-- 9. Dish Allergens
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dish_allergens (
  dish_id        UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  allergen_id    UUID NOT NULL REFERENCES allergens(id) ON DELETE RESTRICT,
  level          allergen_level NOT NULL,
  source_id      UUID,
  confidence     INT CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 100),
  resolved       BOOLEAN NOT NULL DEFAULT false,
  resolution_note TEXT,
  PRIMARY KEY (dish_id, allergen_id)
);
CREATE INDEX IF NOT EXISTS da_allergen_idx ON dish_allergens(allergen_id);

-- 10. Dish Sources (must come before nutrition_profiles and field_evidence FK)
-- ─────────────────────────────────────────────────────────────────────────────
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
CREATE INDEX IF NOT EXISTS ds_dish_id_idx ON dish_sources(dish_id);

-- Add FK from dish_allergens to dish_sources
ALTER TABLE dish_allergens
  ADD CONSTRAINT da_source_id_fk FOREIGN KEY (source_id) REFERENCES dish_sources(id) ON DELETE SET NULL;

-- 11. Nutrition Profiles
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nutrition_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id             UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  serving_name        VARCHAR(100) NOT NULL,
  serving_grams       DECIMAL(8,2) CHECK (serving_grams IS NULL OR serving_grams > 0),
  calories            DECIMAL(8,2) NOT NULL CHECK (calories >= 0),
  protein_g           DECIMAL(8,2) NOT NULL CHECK (protein_g >= 0),
  carbs_g             DECIMAL(8,2) NOT NULL CHECK (carbs_g >= 0),
  fat_g               DECIMAL(8,2) NOT NULL CHECK (fat_g >= 0),
  fiber_g             DECIMAL(8,2) CHECK (fiber_g IS NULL OR fiber_g >= 0),
  sodium_mg           DECIMAL(10,2) CHECK (sodium_mg IS NULL OR sodium_mg >= 0),
  method              nutrition_method NOT NULL,
  source_id           UUID REFERENCES dish_sources(id) ON DELETE SET NULL,
  calculation_version VARCHAR(50),
  disclaimer          TEXT,
  is_primary          BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS np_dish_id_idx ON nutrition_profiles(dish_id);
-- Only one primary nutrition per dish
CREATE UNIQUE INDEX IF NOT EXISTS nutrition_one_primary_per_dish ON nutrition_profiles(dish_id) WHERE is_primary = true;

-- 12. Recipes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id     UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  title       VARCHAR(200),
  servings    INT NOT NULL DEFAULT 1,
  prep_minutes SMALLINT CHECK (prep_minutes IS NULL OR prep_minutes >= 0),
  cook_minutes SMALLINT CHECK (cook_minutes IS NULL OR cook_minutes >= 0),
  source_url  TEXT,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS recipes_dish_id_idx ON recipes(dish_id);

CREATE TABLE IF NOT EXISTS recipe_steps (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id    UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  step_order   INT NOT NULL CHECK (step_order >= 1),
  instruction  TEXT NOT NULL,
  image_url    TEXT,
  duration_min SMALLINT CHECK (duration_min IS NULL OR duration_min >= 0),
  UNIQUE (recipe_id, step_order)
);
CREATE INDEX IF NOT EXISTS rs_recipe_id_idx ON recipe_steps(recipe_id);

-- 13. Dish Media
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dish_media (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id            UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  type               media_type NOT NULL DEFAULT 'IMAGE',
  storage_key        VARCHAR(500) NOT NULL,
  bucket             VARCHAR(100) NOT NULL DEFAULT 'dish-images',
  mime_type          VARCHAR(100) NOT NULL,
  size_bytes         INT NOT NULL,
  width              INT,
  height             INT,
  duration_sec       INT,
  checksum           VARCHAR(100),
  alt_text           VARCHAR(300),
  credit             VARCHAR(300),
  source_url         TEXT,
  moderation_status  moderation_status NOT NULL DEFAULT 'PENDING',
  is_primary         BOOLEAN NOT NULL DEFAULT false,
  sort_order         INT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS dm_dish_moderation_idx ON dish_media(dish_id, moderation_status);
DROP TRIGGER IF EXISTS dish_media_updated_at ON dish_media;
CREATE TRIGGER dish_media_updated_at BEFORE UPDATE ON dish_media FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 14. Import Jobs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS import_jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id          UUID REFERENCES dishes(id) ON DELETE SET NULL,
  query            VARCHAR(150) NOT NULL,
  related_keywords TEXT[] NOT NULL DEFAULT '{}',
  status           import_job_status NOT NULL DEFAULT 'PENDING',
  current_step     import_job_status,
  progress         INT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  source_types     import_source_type[] NOT NULL DEFAULT '{}',
  max_sources      INT NOT NULL DEFAULT 5,
  attempt_count    INT NOT NULL DEFAULT 0,
  max_attempts     INT NOT NULL DEFAULT 3,
  bull_job_id      VARCHAR(200) UNIQUE,
  step_logs        JSONB,
  input_snapshot   JSONB NOT NULL DEFAULT '{}',
  result_snapshot  JSONB,
  error_code       VARCHAR(100),
  error_message    TEXT,
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  created_by       UUID NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ij_status_created_idx ON import_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS ij_created_by_idx ON import_jobs(created_by, created_at);
DROP TRIGGER IF EXISTS import_jobs_updated_at ON import_jobs;
CREATE TRIGGER import_jobs_updated_at BEFORE UPDATE ON import_jobs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 15. Field Evidence
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS field_evidence (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id          UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  source_id        UUID NOT NULL REFERENCES dish_sources(id) ON DELETE RESTRICT,
  import_job_id    UUID REFERENCES import_jobs(id) ON DELETE SET NULL,
  field_path       VARCHAR(255) NOT NULL,
  raw_value        JSONB NOT NULL,
  normalized_value JSONB,
  confidence       INT NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  is_accepted      BOOLEAN NOT NULL DEFAULT false,
  accepted_by      UUID,
  accepted_at      TIMESTAMPTZ,
  resolution_note  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fe_dish_field_idx ON field_evidence(dish_id, field_path);
CREATE INDEX IF NOT EXISTS fe_import_job_idx ON field_evidence(import_job_id);

-- 16. Dish Versions (immutable snapshots)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dish_versions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id        UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  snapshot       JSONB NOT NULL,
  published_by   UUID,
  published_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dish_id, version_number)
);
CREATE INDEX IF NOT EXISTS dv_dish_id_idx ON dish_versions(dish_id);

-- 17. Dish Audit Log (immutable)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dish_audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id     UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  actor_id    UUID,
  action      dish_audit_action NOT NULL,
  from_status dish_status,
  to_status   dish_status,
  reason_code review_reason_code,
  note        TEXT,
  metadata    JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS dal_dish_occurred_idx ON dish_audit_logs(dish_id, occurred_at);
CREATE INDEX IF NOT EXISTS dal_actor_idx ON dish_audit_logs(actor_id);

-- 18. Random History
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS random_histories (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL,
  dish_id          UUID REFERENCES dishes(id) ON DELETE SET NULL,
  criteria_snapshot JSONB NOT NULL,
  score_breakdown  JSONB,
  reason_snapshot  JSONB,
  algorithm_version VARCHAR(20) NOT NULL DEFAULT '1.0',
  is_selected      BOOLEAN NOT NULL DEFAULT false,
  selected_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS rh_user_created_idx ON random_histories(user_id, created_at);
CREATE INDEX IF NOT EXISTS rh_dish_id_idx ON random_histories(dish_id);

-- 19. RBAC — Profile Roles
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profile_roles (
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        system_role NOT NULL,
  assigned_by UUID,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, role)
);
CREATE INDEX IF NOT EXISTS pr_profile_idx ON profile_roles(profile_id);

-- 20. User Diet Types
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_diet_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  diet_type_id UUID NOT NULL REFERENCES diet_types(id) ON DELETE RESTRICT,
  is_hard     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, diet_type_id)
);
CREATE INDEX IF NOT EXISTS udt_user_id_idx ON user_diet_types(user_id);

-- 21. Backfill: migrate old saved_dishes data if it existed under old schema
-- ─────────────────────────────────────────────────────────────────────────────
-- saved_dishes table already exists from previous migration, no changes needed

-- 22. Update allergens table: add dish_allergens relation (allergens table already exists)
-- Just add is_active column if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='allergens' AND column_name='is_active') THEN
    ALTER TABLE allergens ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

-- 23. Update goals table: add is_active if missing  
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='goals' AND column_name='is_active') THEN
    ALTER TABLE goals ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

-- Done
SELECT 'BA-004 Migration completed successfully' AS result;
