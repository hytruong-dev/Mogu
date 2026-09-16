-- Ingredient catalog: status, identity unique, image enrichment candidates

CREATE TYPE "ingredient_status" AS ENUM (
  'PENDING_REVIEW',
  'ACTIVE',
  'REJECTED',
  'MERGED',
  'INACTIVE'
);

CREATE TYPE "ingredient_image_status" AS ENUM (
  'NOT_REQUESTED',
  'QUEUED',
  'SEARCHING',
  'PENDING_REVIEW',
  'APPROVED',
  'NOT_FOUND',
  'FAILED'
);

ALTER TABLE "ingredients"
  ADD COLUMN IF NOT EXISTS "identity_normalized" VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "search_folded" VARCHAR(200) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "status" "ingredient_status" NOT NULL DEFAULT 'PENDING_REVIEW',
  ADD COLUMN IF NOT EXISTS "image_status" "ingredient_image_status" NOT NULL DEFAULT 'NOT_REQUESTED',
  ADD COLUMN IF NOT EXISTS "merged_into_id" UUID,
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

-- Backfill identity from name (keep diacritics, lowercase, collapse spaces)
UPDATE "ingredients"
SET
  "identity_normalized" = lower(trim(regexp_replace(name, '\s+', ' ', 'g'))),
  "search_folded" = lower(trim(regexp_replace(name, '\s+', ' ', 'g'))),
  "status" = CASE WHEN "is_active" THEN 'ACTIVE'::"ingredient_status" ELSE 'INACTIVE'::"ingredient_status" END,
  "image_status" = CASE
    WHEN "image_url" IS NOT NULL AND "image_url" <> '' THEN 'APPROVED'::"ingredient_image_status"
    ELSE 'NOT_REQUESTED'::"ingredient_image_status"
  END
WHERE "identity_normalized" IS NULL;

-- Resolve duplicate identity_normalized before unique index
WITH ranked AS (
  SELECT id,
         identity_normalized,
         ROW_NUMBER() OVER (PARTITION BY identity_normalized ORDER BY created_at ASC, id ASC) AS rn
  FROM ingredients
  WHERE identity_normalized IS NOT NULL
)
UPDATE ingredients i
SET identity_normalized = left(i.identity_normalized, 180) || '-' || substr(replace(i.id::text, '-', ''), 1, 8)
FROM ranked r
WHERE i.id = r.id AND r.rn > 1;

ALTER TABLE "ingredients"
  ALTER COLUMN "identity_normalized" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ingredients_identity_normalized_key"
  ON "ingredients"("identity_normalized");

CREATE INDEX IF NOT EXISTS "ingredients_search_folded_idx" ON "ingredients"("search_folded");
CREATE INDEX IF NOT EXISTS "ingredients_status_idx" ON "ingredients"("status");
CREATE INDEX IF NOT EXISTS "ingredients_image_status_idx" ON "ingredients"("image_status");

ALTER TABLE "ingredients"
  ADD CONSTRAINT "ingredients_merged_into_id_fkey"
  FOREIGN KEY ("merged_into_id") REFERENCES "ingredients"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ingredient_image_candidates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ingredient_id" UUID NOT NULL,
  "provider" VARCHAR(50) NOT NULL,
  "provider_asset_id" VARCHAR(200) NOT NULL,
  "source_page_url" TEXT NOT NULL,
  "original_url" TEXT NOT NULL,
  "preview_url" TEXT,
  "author" TEXT,
  "author_url" TEXT,
  "license_code" VARCHAR(100) NOT NULL,
  "license_url" TEXT,
  "width" INTEGER,
  "height" INTEGER,
  "mime_type" VARCHAR(100),
  "score" INTEGER NOT NULL DEFAULT 0,
  "score_breakdown" JSONB NOT NULL DEFAULT '{}',
  "status" VARCHAR(40) NOT NULL DEFAULT 'FOUND',
  "storage_key" VARCHAR(500),
  "checksum_sha256" VARCHAR(64),
  "fetched_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ingredient_image_candidates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ingredient_image_candidates_ingredient_id_fkey"
    FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ingredient_image_candidates_ingredient_id_provider_provider_asset_id_key"
  ON "ingredient_image_candidates"("ingredient_id", "provider", "provider_asset_id");

CREATE INDEX IF NOT EXISTS "ingredient_image_candidates_ingredient_id_score_idx"
  ON "ingredient_image_candidates"("ingredient_id", "score" DESC);
