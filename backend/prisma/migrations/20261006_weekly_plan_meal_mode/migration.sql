-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "weekly_meal_mode" AS ENUM ('HOME_COOK', 'EAT_OUT', 'FLEXIBLE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "weekly_plan_configs"
  ADD COLUMN IF NOT EXISTS "meal_mode" "weekly_meal_mode" NOT NULL DEFAULT 'FLEXIBLE';

ALTER TABLE "weekly_plan_slots"
  ADD COLUMN IF NOT EXISTS "price_source" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "servings_snapshot" DECIMAL(6,2);
