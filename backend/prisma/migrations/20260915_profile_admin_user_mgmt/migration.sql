-- Profile + Admin User Management schema expansion (2026-09-15)

-- Enums
DO $$ BEGIN
  CREATE TYPE "avoidance_mode" AS ENUM ('SOFT', 'HARD');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "avoidance_resolution_status" AS ENUM ('RESOLVED', 'FREE_TEXT', 'UNRESOLVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "user_media_purpose" AS ENUM ('AVATAR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "user_media_status" AS ENUM ('UPLOAD_PENDING', 'PROCESSING', 'APPROVED', 'REJECTED', 'FAILED', 'DELETED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "restriction_type" AS ENUM ('POLICY_SUSPENSION', 'SECURITY_LOCK', 'FEATURE_RESTRICTION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "restriction_status" AS ENUM ('SCHEDULED', 'ACTIVE', 'ENDED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "profile_visibility" AS ENUM ('PUBLIC', 'FOLLOWERS', 'PRIVATE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- PostStatus DRAFT
DO $$ BEGIN
  ALTER TYPE "post_status" ADD VALUE IF NOT EXISTS 'DRAFT';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- Account: userId + usernameNormalized
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "user_id" UUID;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "username_normalized" VARCHAR(32);

-- Backfill user_id from password_hash when it looks like a UUID
UPDATE "accounts"
SET "user_id" = "password_hash"::uuid
WHERE "user_id" IS NULL
  AND "password_hash" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

UPDATE "accounts"
SET "username_normalized" = lower("username")
WHERE "username_normalized" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "accounts_user_id_key" ON "accounts"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_username_normalized_key" ON "accounts"("username_normalized");

-- Profile fields
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "bio" TEXT;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "region_id" UUID;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "avatar_media_id" UUID;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "activity_level" VARCHAR(32);

DO $$ BEGIN
  ALTER TABLE "profiles"
    ADD CONSTRAINT "profiles_region_id_fkey"
    FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- User avoided ingredients expansion
ALTER TABLE "user_avoided_ingredients" ADD COLUMN IF NOT EXISTS "ingredient_id" UUID;
ALTER TABLE "user_avoided_ingredients" ADD COLUMN IF NOT EXISTS "normalized_text" VARCHAR(120);
ALTER TABLE "user_avoided_ingredients" ADD COLUMN IF NOT EXISTS "mode" "avoidance_mode" NOT NULL DEFAULT 'SOFT';
ALTER TABLE "user_avoided_ingredients" ADD COLUMN IF NOT EXISTS "resolution_status" "avoidance_resolution_status" NOT NULL DEFAULT 'FREE_TEXT';
ALTER TABLE "user_avoided_ingredients" ADD COLUMN IF NOT EXISTS "reason_code" VARCHAR(64);

UPDATE "user_avoided_ingredients"
SET "normalized_text" = lower(trim("ingredient_name"))
WHERE "normalized_text" IS NULL;

DO $$ BEGIN
  ALTER TABLE "user_avoided_ingredients"
    ADD CONSTRAINT "user_avoided_ingredients_ingredient_id_fkey"
    FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "user_avoided_ingredients_user_id_ingredient_id_idx"
  ON "user_avoided_ingredients"("user_id", "ingredient_id");

-- User settings privacy/notification fields
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "weekly_plan_notif" BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "community_notif" BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "marketing_notif" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "profile_visibility" "profile_visibility" NOT NULL DEFAULT 'PUBLIC';
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "show_diet_activity" BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "allow_comments" BOOLEAN NOT NULL DEFAULT TRUE;

-- Privacy jobs expansion
ALTER TABLE "privacy_jobs" ADD COLUMN IF NOT EXISTS "result_storage_key" VARCHAR(512);
ALTER TABLE "privacy_jobs" ADD COLUMN IF NOT EXISTS "idempotency_key" VARCHAR(128);
ALTER TABLE "privacy_jobs" ADD COLUMN IF NOT EXISTS "progress" INTEGER;
ALTER TABLE "privacy_jobs" ADD COLUMN IF NOT EXISTS "error_code" VARCHAR(64);
ALTER TABLE "privacy_jobs" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMPTZ;
ALTER TABLE "privacy_jobs" ADD COLUMN IF NOT EXISTS "finished_at" TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS "privacy_jobs_idempotency_key_idx" ON "privacy_jobs"("idempotency_key");

-- User media
CREATE TABLE IF NOT EXISTS "user_media" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "profiles"("user_id") ON DELETE CASCADE,
  "purpose" "user_media_purpose" NOT NULL DEFAULT 'AVATAR',
  "object_key" VARCHAR(512) NOT NULL UNIQUE,
  "mime_type" VARCHAR(64) NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "checksum_sha256" VARCHAR(128),
  "status" "user_media_status" NOT NULL DEFAULT 'UPLOAD_PENDING',
  "variants" JSONB NOT NULL DEFAULT '{}',
  "rejection_reason" VARCHAR(128),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "user_media_user_id_purpose_created_at_idx"
  ON "user_media"("user_id", "purpose", "created_at" DESC);

DO $$ BEGIN
  ALTER TABLE "profiles"
    ADD CONSTRAINT "profiles_avatar_media_id_fkey"
    FOREIGN KEY ("avatar_media_id") REFERENCES "user_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Selection priority catalog + user priorities
CREATE TABLE IF NOT EXISTS "selection_priority_catalog" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(32) NOT NULL UNIQUE,
  "name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO "selection_priority_catalog" ("code", "name", "display_order")
VALUES
  ('PRICE', 'Giá cả', 1),
  ('TIME', 'Thời gian', 2),
  ('HEALTH', 'Sức khỏe', 3),
  ('TASTE', 'Khẩu vị', 4)
ON CONFLICT ("code") DO NOTHING;

CREATE TABLE IF NOT EXISTS "user_selection_priorities" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "profiles"("user_id") ON DELETE CASCADE,
  "code" VARCHAR(32) NOT NULL,
  "weight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "user_selection_priorities_user_id_code_key" UNIQUE ("user_id", "code")
);

-- Achievements
CREATE TABLE IF NOT EXISTS "achievement_definitions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(64) NOT NULL UNIQUE,
  "name" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "icon_key" VARCHAR(64),
  "target_value" INTEGER NOT NULL DEFAULT 1,
  "rule_meta" JSONB NOT NULL DEFAULT '{}',
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO "achievement_definitions" ("code", "name", "description", "icon_key", "target_value")
VALUES
  ('FIRST_LOG', 'Bữa Ăn Đầu Tiên', 'Ghi nhận bữa ăn đầu tiên', 'utensils', 1),
  ('STREAK_7', 'Chuỗi 7 Ngày', 'Duy trì chuỗi 7 ngày ghi bữa ăn', 'flame', 7),
  ('EXPLORER_10', 'Người khám phá', 'Thử 10 món khác nhau', 'sparkles', 10)
ON CONFLICT ("code") DO NOTHING;

CREATE TABLE IF NOT EXISTS "user_achievements" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "profiles"("user_id") ON DELETE CASCADE,
  "achievement_id" UUID NOT NULL REFERENCES "achievement_definitions"("id") ON DELETE CASCADE,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "earned_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "user_achievements_user_id_achievement_id_key" UNIQUE ("user_id", "achievement_id")
);
CREATE INDEX IF NOT EXISTS "user_achievements_user_id_earned_at_idx"
  ON "user_achievements"("user_id", "earned_at");

-- Account restrictions
CREATE TABLE IF NOT EXISTS "account_restrictions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "profiles"("user_id") ON DELETE CASCADE,
  "type" "restriction_type" NOT NULL,
  "status" "restriction_status" NOT NULL DEFAULT 'ACTIVE',
  "reason_code" VARCHAR(64) NOT NULL,
  "reason_note" TEXT,
  "case_id" VARCHAR(64),
  "starts_at" TIMESTAMPTZ NOT NULL,
  "ends_at" TIMESTAMPTZ,
  "created_by" UUID NOT NULL,
  "ended_by" UUID,
  "ended_at" TIMESTAMPTZ,
  "end_reason_code" VARCHAR(64),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "account_restrictions_user_id_status_starts_at_ends_at_idx"
  ON "account_restrictions"("user_id", "status", "starts_at", "ends_at");
CREATE INDEX IF NOT EXISTS "account_restrictions_case_id_idx"
  ON "account_restrictions"("case_id");

-- Admin action audit
CREATE TABLE IF NOT EXISTS "admin_action_audits" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "actor_user_id" UUID NOT NULL,
  "target_type" VARCHAR(64) NOT NULL,
  "target_id" UUID NOT NULL,
  "action" VARCHAR(64) NOT NULL,
  "reason_code" VARCHAR(64),
  "case_id" VARCHAR(64),
  "request_id" VARCHAR(64),
  "result" VARCHAR(32) NOT NULL DEFAULT 'SUCCESS',
  "before_sanitized" JSONB,
  "after_sanitized" JSONB,
  "ip_hash" VARCHAR(64),
  "user_agent_hash" VARCHAR(64),
  "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "admin_action_audits_target_type_target_id_occurred_at_idx"
  ON "admin_action_audits"("target_type", "target_id", "occurred_at" DESC);
CREATE INDEX IF NOT EXISTS "admin_action_audits_actor_user_id_occurred_at_idx"
  ON "admin_action_audits"("actor_user_id", "occurred_at" DESC);

-- Admin export jobs
CREATE TABLE IF NOT EXISTS "admin_export_jobs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "actor_user_id" UUID NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'QUEUED',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "filters_snapshot" JSONB NOT NULL DEFAULT '{}',
  "columns_snapshot" JSONB NOT NULL DEFAULT '[]',
  "format" VARCHAR(16) NOT NULL DEFAULT 'CSV',
  "storage_key" VARCHAR(512),
  "result_url" TEXT,
  "checksum_sha256" VARCHAR(128),
  "download_count" INTEGER NOT NULL DEFAULT 0,
  "error_code" VARCHAR(64),
  "expires_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "admin_export_jobs_actor_user_id_created_at_idx"
  ON "admin_export_jobs"("actor_user_id", "created_at" DESC);
