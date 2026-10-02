-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ingredient_created_via" AS ENUM ('MANUAL', 'AI_IMPORT', 'ADMIN_PICKER', 'FILE_IMPORT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "ingredients"
  ADD COLUMN IF NOT EXISTS "name_en" VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "description" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "group_label" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "created_via" "ingredient_created_via" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "enrichment" JSONB,
  ADD COLUMN IF NOT EXISTS "enriched_at" TIMESTAMP(3);
