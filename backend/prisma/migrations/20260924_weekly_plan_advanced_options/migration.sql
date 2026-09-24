-- Weekly plan advanced options + meal slot schedule (UX redesign 2026)

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'liked_dish_preference') THEN
    CREATE TYPE "liked_dish_preference" AS ENUM ('NONE', 'LIGHT', 'HIGH');
  END IF;
END $$;

ALTER TABLE "weekly_plan_configs"
  ADD COLUMN IF NOT EXISTS "meal_slot_schedule" JSONB,
  ADD COLUMN IF NOT EXISTS "allow_outside_meals" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "repeat_window_days" INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS "prefer_new_dishes" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "liked_dish_preference" "liked_dish_preference" NOT NULL DEFAULT 'LIGHT',
  ADD COLUMN IF NOT EXISTS "keep_locked_meals" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "preserve_logged_days" BOOLEAN NOT NULL DEFAULT true;
