-- Health diary meal logs + water (docs 01)

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'diary_meal_slot') THEN
    CREATE TYPE "diary_meal_slot" AS ENUM ('BREAKFAST','LUNCH','DINNER','SNACK');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'diary_meal_source_type') THEN
    CREATE TYPE "diary_meal_source_type" AS ENUM ('DISH','INGREDIENT','CUSTOM','RANDOM','WEEKLY_PLAN','CAMERA','MANUAL');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'diary_item_reference_type') THEN
    CREATE TYPE "diary_item_reference_type" AS ENUM ('DISH','INGREDIENT','CUSTOM_FOOD');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "diary_meal_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "profiles"("user_id") ON DELETE CASCADE,
  "meal_slot" "diary_meal_slot" NOT NULL,
  "occurred_at" TIMESTAMPTZ NOT NULL,
  "local_date" DATE NOT NULL,
  "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  "source_type" "diary_meal_source_type" NOT NULL,
  "randomization_id" UUID,
  "weekly_plan_slot_id" UUID,
  "note" TEXT,
  "total_kcal" INTEGER NOT NULL DEFAULT 0,
  "total_protein_g" DECIMAL(8,2),
  "total_carbs_g" DECIMAL(8,2),
  "total_fat_g" DECIMAL(8,2),
  "nutrition_coverage" DECIMAL(5,4),
  "version" INTEGER NOT NULL DEFAULT 1,
  "deleted_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "diary_meal_logs_weekly_plan_slot_id_key"
  ON "diary_meal_logs" ("weekly_plan_slot_id") WHERE "weekly_plan_slot_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "diary_meal_logs_user_date_idx"
  ON "diary_meal_logs" ("user_id", "local_date", "occurred_at");

CREATE INDEX IF NOT EXISTS "diary_meal_logs_user_occurred_idx"
  ON "diary_meal_logs" ("user_id", "occurred_at" DESC);

CREATE TABLE IF NOT EXISTS "diary_meal_log_items" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "meal_log_id" UUID NOT NULL REFERENCES "diary_meal_logs"("id") ON DELETE CASCADE,
  "reference_type" "diary_item_reference_type" NOT NULL,
  "reference_id" UUID,
  "display_name" VARCHAR(200) NOT NULL,
  "quantity" DECIMAL(10,3) NOT NULL,
  "unit_code" VARCHAR(32) NOT NULL DEFAULT 'SERVING',
  "gram_equivalent" DECIMAL(10,3),
  "calories_snapshot" DECIMAL(8,2),
  "protein_g_snapshot" DECIMAL(8,2),
  "carbs_g_snapshot" DECIMAL(8,2),
  "fat_g_snapshot" DECIMAL(8,2),
  "nutrition_basis" VARCHAR(32),
  "sort_order" INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "diary_meal_log_items_meal_log_idx"
  ON "diary_meal_log_items" ("meal_log_id");

CREATE TABLE IF NOT EXISTS "water_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "profiles"("user_id") ON DELETE CASCADE,
  "amount_ml" INTEGER NOT NULL,
  "occurred_at" TIMESTAMPTZ NOT NULL,
  "local_date" DATE NOT NULL,
  "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  "source" VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
  "idempotency_key" VARCHAR(128) UNIQUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "water_logs_user_date_idx"
  ON "water_logs" ("user_id", "local_date", "occurred_at");
