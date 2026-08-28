-- AI Import v1.1 persistence groundwork.
-- Existing dish data remains valid: new aggregate metadata is nullable or defaulted.

DO $$ BEGIN
  CREATE TYPE import_job_status AS ENUM (
    'PENDING',
    'SEARCHING',
    'EXTRACTING',
    'NORMALIZING',
    'RECONCILING',
    'ENRICHING',
    'DRAFTING',
    'DONE',
    'FAILED',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ingredient_resolution_method AS ENUM (
    'EXACT',
    'ALIAS',
    'NORMALIZED',
    'FUZZY',
    'NONE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE nutrition_basis AS ENUM (
    'PER_SERVING',
    'PER_100G',
    'WHOLE_RECIPE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE nutrition_method AS ENUM (
    'AI_ESTIMATED',
    'INGREDIENT_CALCULATED',
    'SOURCE_VERIFIED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Một số database cũ đã có enum nutrition_method với tập giá trị legacy.
-- CREATE TYPE phía trên sẽ bị bỏ qua, vì vậy cần bổ sung từng giá trị v1.1.
ALTER TYPE nutrition_method ADD VALUE IF NOT EXISTS 'AI_ESTIMATED';
ALTER TYPE nutrition_method ADD VALUE IF NOT EXISTS 'INGREDIENT_CALCULATED';
ALTER TYPE nutrition_method ADD VALUE IF NOT EXISTS 'SOURCE_VERIFIED';

CREATE TABLE IF NOT EXISTS import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query VARCHAR(150) NOT NULL,
  status import_job_status NOT NULL DEFAULT 'PENDING',
  current_step INTEGER NOT NULL DEFAULT 0,
  total_steps INTEGER NOT NULL DEFAULT 6,
  progress INTEGER NOT NULL DEFAULT 0,
  current_step_name VARCHAR(100),
  current_step_message TEXT,
  related_keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  region_hint VARCHAR(50),
  source_types TEXT[] NOT NULL DEFAULT ARRAY['AI_GENERATED']::TEXT[],
  result_dish_id UUID,
  suggested_image_url TEXT,
  error_code VARCHAR(100),
  error_message TEXT,
  completion_percent INTEGER NOT NULL DEFAULT 0,
  warnings JSONB,
  unresolved_fields TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  taxonomy_snapshot_version VARCHAR(100),
  taxonomy_snapshot JSONB,
  extraction_snapshot JSONB,
  normalized_snapshot JSONB,
  resolution_snapshot JSONB,
  nutrition_snapshot JSONB,
  field_metadata JSONB,
  audit_metadata JSONB,
  pipeline_version VARCHAR(32) NOT NULL DEFAULT '1.1',
  schema_version VARCHAR(32) NOT NULL DEFAULT '1.1',
  provider VARCHAR(100),
  model VARCHAR(200),
  idempotency_key VARCHAR(100),
  requested_by UUID,
  cancel_requested BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT import_jobs_progress_check CHECK (progress BETWEEN 0 AND 100),
  CONSTRAINT import_jobs_completion_percent_check CHECK (completion_percent BETWEEN 0 AND 100),
  CONSTRAINT import_jobs_step_check CHECK (
    current_step >= 0 AND total_steps > 0 AND current_step <= total_steps
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS import_jobs_result_dish_id_key
  ON import_jobs(result_dish_id);
CREATE UNIQUE INDEX IF NOT EXISTS import_jobs_idempotency_key_key
  ON import_jobs(idempotency_key);
CREATE INDEX IF NOT EXISTS import_jobs_status_updated_at_idx
  ON import_jobs(status, updated_at);
CREATE INDEX IF NOT EXISTS import_jobs_requested_by_created_at_idx
  ON import_jobs(requested_by, created_at DESC);

ALTER TABLE dish_ingredients
  ADD COLUMN IF NOT EXISTS quantity_to NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS quantity_text VARCHAR(100),
  ADD COLUMN IF NOT EXISTS specification VARCHAR(200),
  ADD COLUMN IF NOT EXISTS alternative_note VARCHAR(200),
  ADD COLUMN IF NOT EXISTS normalized_weight_g NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS parse_metadata JSONB,
  ADD COLUMN IF NOT EXISTS resolution_method ingredient_resolution_method,
  ADD COLUMN IF NOT EXISTS resolution_confidence INTEGER,
  ADD COLUMN IF NOT EXISTS resolution_candidates JSONB,
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT FALSE;

DO $$ BEGIN
  ALTER TABLE dish_ingredients
    ADD CONSTRAINT dish_ingredients_resolution_confidence_check
    CHECK (
      resolution_confidence IS NULL
      OR resolution_confidence BETWEEN 0 AND 100
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE dish_nutrition
  ADD COLUMN IF NOT EXISTS basis nutrition_basis,
  ADD COLUMN IF NOT EXISTS servings NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS method nutrition_method,
  ADD COLUMN IF NOT EXISTS confidence INTEGER,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS provenance JSONB;

DO $$ BEGIN
  ALTER TABLE dish_nutrition
    ADD CONSTRAINT dish_nutrition_confidence_check
    CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE dish_nutrition
    ADD CONSTRAINT dish_nutrition_servings_check
    CHECK (servings IS NULL OR servings > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE dish_nutrition
    ADD CONSTRAINT dish_nutrition_verified_source_check
    CHECK (
      method::text IS DISTINCT FROM 'SOURCE_VERIFIED'
      OR source_url IS NOT NULL
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
