-- BA-005 Weekly Meal Plan (versioned Prisma migration)
-- Idempotent: safe on DBs that already ran scripts/migrate-weekly-plan.ts

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'weekly_plan_status') THEN
    CREATE TYPE "weekly_plan_status" AS ENUM (
      'GENERATING','READY','ACTIVE','COMPLETED','FAILED','CANCELLED','ARCHIVED'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'weekly_plan_slot_status') THEN
    CREATE TYPE "weekly_plan_slot_status" AS ENUM ('PLANNED','COMPLETED','SKIPPED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'weekly_meal_slot') THEN
    CREATE TYPE "weekly_meal_slot" AS ENUM ('MORNING','LUNCH','DINNER','SNACK');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'weekly_kcal_mode') THEN
    CREATE TYPE "weekly_kcal_mode" AS ENUM ('PROFILE','CUSTOM');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'weekly_plan_swap_reason') THEN
    CREATE TYPE "weekly_plan_swap_reason" AS ENUM (
      'USER_REQUEST','REBALANCE_BUDGET','REBALANCE_CALORIES',
      'DISH_UNAVAILABLE','DIET_CONFLICT','OTHER'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "weekly_plan_configs" (
  "id"                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"                   UUID NOT NULL UNIQUE REFERENCES "profiles"("user_id") ON DELETE CASCADE,
  "budget_vnd"                INTEGER NOT NULL,
  "kcal_per_day"              INTEGER NOT NULL,
  "kcal_mode"                 "weekly_kcal_mode" NOT NULL DEFAULT 'PROFILE',
  "duration_days"             INTEGER NOT NULL DEFAULT 7,
  "meals_per_day"             INTEGER NOT NULL DEFAULT 3,
  "enabled_slots"             "weekly_meal_slot"[] NOT NULL DEFAULT ARRAY['MORNING','LUNCH','DINNER']::"weekly_meal_slot"[],
  "avoid_repeat"              BOOLEAN NOT NULL DEFAULT TRUE,
  "prefer_home_cook"          BOOLEAN NOT NULL DEFAULT FALSE,
  "calorie_tolerance_percent" INTEGER NOT NULL DEFAULT 10,
  "created_at"                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "weekly_plans" (
  "id"                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"                UUID NOT NULL REFERENCES "profiles"("user_id") ON DELETE CASCADE,
  "config_id"              UUID NOT NULL REFERENCES "weekly_plan_configs"("id") ON DELETE RESTRICT,
  "start_date"             DATE NOT NULL,
  "end_date"               DATE NOT NULL,
  "status"                 "weekly_plan_status" NOT NULL DEFAULT 'GENERATING',
  "budget_limit_vnd"       INTEGER NOT NULL,
  "projected_cost_vnd"     INTEGER NOT NULL DEFAULT 0,
  "actual_spent_vnd"       INTEGER NOT NULL DEFAULT 0,
  "target_kcal"            INTEGER NOT NULL,
  "projected_kcal"         INTEGER NOT NULL DEFAULT 0,
  "actual_kcal"            INTEGER NOT NULL DEFAULT 0,
  "config_snapshot"        JSONB NOT NULL DEFAULT '{}',
  "profile_snapshot"       JSONB,
  "algorithm_version"      VARCHAR(20) NOT NULL DEFAULT '1.0',
  "generation_error_code"  VARCHAR(100),
  "generation_error_data"  JSONB,
  "started_at"             TIMESTAMPTZ,
  "completed_at"           TIMESTAMPTZ,
  "archived_at"            TIMESTAMPTZ,
  "version"                INTEGER NOT NULL DEFAULT 1,
  "created_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "weekly_plan_slots" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "plan_id"             UUID NOT NULL REFERENCES "weekly_plans"("id") ON DELETE CASCADE,
  "dish_id"             UUID NOT NULL REFERENCES "dishes"("id") ON DELETE RESTRICT,
  "date"                DATE NOT NULL,
  "meal_slot"           "weekly_meal_slot" NOT NULL,
  "status"              "weekly_plan_slot_status" NOT NULL DEFAULT 'PLANNED',
  "servings"            DECIMAL(6,2) NOT NULL DEFAULT 1,
  "is_locked"           BOOLEAN NOT NULL DEFAULT FALSE,
  "swap_count"          INTEGER NOT NULL DEFAULT 0,
  "dish_name_snapshot"  VARCHAR(150) NOT NULL,
  "image_url_snapshot"  TEXT,
  "price_snapshot_vnd"  INTEGER NOT NULL,
  "kcal_snapshot"       INTEGER NOT NULL,
  "protein_g_snapshot"  DECIMAL(8,2),
  "carbs_g_snapshot"    DECIMAL(8,2),
  "fat_g_snapshot"      DECIMAL(8,2),
  "score_snapshot"      JSONB,
  "reason_snapshot"     JSONB,
  "actual_cost_vnd"     INTEGER,
  "actual_kcal"         INTEGER,
  "completed_at"        TIMESTAMPTZ,
  "skipped_at"          TIMESTAMPTZ,
  "version"             INTEGER NOT NULL DEFAULT 1,
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("plan_id", "date", "meal_slot")
);

CREATE TABLE IF NOT EXISTS "weekly_plan_slot_swaps" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "slot_id"           UUID NOT NULL REFERENCES "weekly_plan_slots"("id") ON DELETE CASCADE,
  "previous_dish_id"  UUID NOT NULL,
  "new_dish_id"       UUID NOT NULL,
  "previous_cost_vnd" INTEGER NOT NULL,
  "new_cost_vnd"      INTEGER NOT NULL,
  "previous_kcal"     INTEGER NOT NULL,
  "new_kcal"          INTEGER NOT NULL,
  "reason"            "weekly_plan_swap_reason" NOT NULL DEFAULT 'USER_REQUEST',
  "score_snapshot"    JSONB,
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_wpc_budget_positive') THEN
    ALTER TABLE "weekly_plan_configs"
      ADD CONSTRAINT "chk_wpc_budget_positive" CHECK ("budget_vnd" > 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_wpc_kcal_range') THEN
    ALTER TABLE "weekly_plan_configs"
      ADD CONSTRAINT "chk_wpc_kcal_range" CHECK ("kcal_per_day" BETWEEN 800 AND 5000);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_wpc_duration') THEN
    ALTER TABLE "weekly_plan_configs"
      ADD CONSTRAINT "chk_wpc_duration" CHECK ("duration_days" IN (3, 5, 7, 14));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_wp_date_range') THEN
    ALTER TABLE "weekly_plans"
      ADD CONSTRAINT "chk_wp_date_range" CHECK ("end_date" > "start_date");
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "weekly_plans_one_active_per_user_idx"
  ON "weekly_plans" ("user_id") WHERE status = 'ACTIVE';

CREATE UNIQUE INDEX IF NOT EXISTS "weekly_plans_one_generating_per_user_idx"
  ON "weekly_plans" ("user_id") WHERE status = 'GENERATING';

CREATE INDEX IF NOT EXISTS "idx_weekly_plans_user_status" ON "weekly_plans" ("user_id", "status");
CREATE INDEX IF NOT EXISTS "idx_weekly_plans_user_start_date" ON "weekly_plans" ("user_id", "start_date" DESC);
CREATE INDEX IF NOT EXISTS "idx_weekly_plan_slots_plan_date" ON "weekly_plan_slots" ("plan_id", "date");
CREATE INDEX IF NOT EXISTS "idx_weekly_plan_slots_dish" ON "weekly_plan_slots" ("dish_id");
CREATE INDEX IF NOT EXISTS "idx_weekly_plan_slot_swaps_slot" ON "weekly_plan_slot_swaps" ("slot_id", "created_at" DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_weekly_plan_configs_updated_at" ON "weekly_plan_configs";
CREATE TRIGGER "trg_weekly_plan_configs_updated_at"
  BEFORE UPDATE ON "weekly_plan_configs"
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS "trg_weekly_plans_updated_at" ON "weekly_plans";
CREATE TRIGGER "trg_weekly_plans_updated_at"
  BEFORE UPDATE ON "weekly_plans"
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS "trg_weekly_plan_slots_updated_at" ON "weekly_plan_slots";
CREATE TRIGGER "trg_weekly_plan_slots_updated_at"
  BEFORE UPDATE ON "weekly_plan_slots"
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
