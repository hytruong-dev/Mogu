-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "dish_type" AS ENUM ('WET', 'DRY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "dishes"
  ADD COLUMN IF NOT EXISTS "dine_out_price_min" INTEGER,
  ADD COLUMN IF NOT EXISTS "dine_out_price_max" INTEGER,
  ADD COLUMN IF NOT EXISTS "dish_type" "dish_type",
  ADD COLUMN IF NOT EXISTS "video_url" VARCHAR(500);
