-- P0/P1 schema expansion: health tables + settings/sessions/community/privacy/outbox

-- Ensure accounts + refresh_sessions exist (were in schema but never migrated)
CREATE TABLE IF NOT EXISTS "accounts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "username" VARCHAR(32) NOT NULL UNIQUE,
  "password_hash" TEXT NOT NULL,
  "must_change_password" BOOLEAN NOT NULL DEFAULT FALSE,
  "token_version" INTEGER NOT NULL DEFAULT 0,
  "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TIMESTAMPTZ,
  "last_login_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "refresh_sessions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "account_id" UUID NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "token_hash" VARCHAR(64) NOT NULL UNIQUE,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "revoked_at" TIMESTAMPTZ,
  "replaced_by_id" UUID,
  "user_agent_hash" VARCHAR(64),
  "ip_hash" VARCHAR(64),
  "installation_id" VARCHAR(128),
  "platform" VARCHAR(32),
  "device_label" VARCHAR(128),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "last_used_at" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "refresh_sessions_account_id_revoked_at_idx"
  ON "refresh_sessions"("account_id", "revoked_at");
CREATE INDEX IF NOT EXISTS "refresh_sessions_expires_at_idx"
  ON "refresh_sessions"("expires_at");

-- Safe add columns if table already existed without them
DO $$ BEGIN
  ALTER TABLE "refresh_sessions" ADD COLUMN IF NOT EXISTS "installation_id" VARCHAR(128);
  ALTER TABLE "refresh_sessions" ADD COLUMN IF NOT EXISTS "platform" VARCHAR(32);
  ALTER TABLE "refresh_sessions" ADD COLUMN IF NOT EXISTS "device_label" VARCHAR(128);
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "token_hash" VARCHAR(64) NOT NULL UNIQUE,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "used_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_id_expires_at_idx"
  ON "password_reset_tokens"("user_id", "expires_at");

CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "token_hash" VARCHAR(64) NOT NULL UNIQUE,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "used_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "email_verification_tokens_user_id_expires_at_idx"
  ON "email_verification_tokens"("user_id", "expires_at");

CREATE TABLE IF NOT EXISTS "custom_foods" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "profiles"("user_id") ON DELETE CASCADE,
  "name" VARCHAR(200) NOT NULL,
  "calories" DECIMAL(8,2) NOT NULL,
  "protein_g" DECIMAL(8,2),
  "fat_g" DECIMAL(8,2),
  "carbs_g" DECIMAL(8,2),
  "serving_size" VARCHAR(100),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "archived_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "custom_foods_user_id_name_idx" ON "custom_foods"("user_id", "name");

CREATE TABLE IF NOT EXISTS "profile_measurements" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "profiles"("user_id") ON DELETE CASCADE,
  "type" VARCHAR(32) NOT NULL,
  "value_decimal" DECIMAL(8,2) NOT NULL,
  "unit" VARCHAR(16) NOT NULL DEFAULT 'kg',
  "measured_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "profile_measurements_user_type_measured_idx"
  ON "profile_measurements"("user_id", "type", "measured_at" DESC);

CREATE TABLE IF NOT EXISTS "health_targets" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "profiles"("user_id") ON DELETE CASCADE,
  "mode" VARCHAR(32) NOT NULL DEFAULT 'SYSTEM_ESTIMATED',
  "energy_kcal" INTEGER,
  "protein_g" DOUBLE PRECISION,
  "carbs_g" DOUBLE PRECISION,
  "fat_g" DOUBLE PRECISION,
  "water_ml" INTEGER,
  "steps" INTEGER,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "health_targets_user_id_idx" ON "health_targets"("user_id");

CREATE TABLE IF NOT EXISTS "activity_buckets" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "profiles"("user_id") ON DELETE CASCADE,
  "provider" VARCHAR(64) NOT NULL,
  "type" VARCHAR(32) NOT NULL,
  "start_at" TIMESTAMPTZ NOT NULL,
  "end_at" TIMESTAMPTZ NOT NULL,
  "value" DECIMAL(12,2) NOT NULL,
  "dedupe_key" VARCHAR(128),
  "synced_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "activity_buckets_dedupe_uidx"
  ON "activity_buckets"("user_id", "provider", "type", "start_at", "end_at", "dedupe_key");

CREATE TABLE IF NOT EXISTS "user_settings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL UNIQUE REFERENCES "profiles"("user_id") ON DELETE CASCADE,
  "push_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "meal_reminders" BOOLEAN NOT NULL DEFAULT TRUE,
  "water_reminders" BOOLEAN NOT NULL DEFAULT TRUE,
  "share_data" BOOLEAN NOT NULL DEFAULT FALSE,
  "analytics_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "app_theme" VARCHAR(32) NOT NULL DEFAULT 'system',
  "language" VARCHAR(16) NOT NULL DEFAULT 'vi',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "push_installations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "profiles"("user_id") ON DELETE CASCADE,
  "token" VARCHAR(512) NOT NULL,
  "platform" VARCHAR(32) NOT NULL,
  "app_version" VARCHAR(32),
  "invalidated_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "push_installations_user_token_uidx"
  ON "push_installations"("user_id", "token");
CREATE INDEX IF NOT EXISTS "push_installations_user_id_idx" ON "push_installations"("user_id");

CREATE TABLE IF NOT EXISTS "user_follows" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "follower_id" UUID NOT NULL REFERENCES "profiles"("user_id") ON DELETE CASCADE,
  "following_id" UUID NOT NULL REFERENCES "profiles"("user_id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_follows_follower_following_uidx"
  ON "user_follows"("follower_id", "following_id");
CREATE INDEX IF NOT EXISTS "user_follows_following_id_idx" ON "user_follows"("following_id");

-- Community / articles tables may already exist from app bootstrap; create minimal shells if missing
DO $$ BEGIN
  CREATE TYPE "post_status" AS ENUM ('ACTIVE', 'HIDDEN', 'DELETED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "article_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "community_posts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "author_id" UUID NOT NULL REFERENCES "profiles"("user_id") ON DELETE CASCADE,
  "content" TEXT NOT NULL,
  "image_urls" TEXT[] NOT NULL DEFAULT '{}',
  "status" "post_status" NOT NULL DEFAULT 'ACTIVE',
  "like_count" INTEGER NOT NULL DEFAULT 0,
  "comment_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "post_comments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "post_id" UUID NOT NULL REFERENCES "community_posts"("id") ON DELETE CASCADE,
  "author_id" UUID NOT NULL REFERENCES "profiles"("user_id") ON DELETE CASCADE,
  "content" TEXT NOT NULL,
  "parent_comment_id" UUID REFERENCES "post_comments"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "articles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" VARCHAR(200) NOT NULL UNIQUE,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "content" TEXT,
  "cover_image_url" TEXT,
  "read_minutes" INTEGER,
  "view_count" INTEGER NOT NULL DEFAULT 0,
  "status" "article_status" NOT NULL DEFAULT 'DRAFT',
  "author_id" UUID REFERENCES "profiles"("user_id") ON DELETE SET NULL,
  "topic_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "saved_posts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "profiles"("user_id") ON DELETE CASCADE,
  "post_id" UUID NOT NULL REFERENCES "community_posts"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "saved_posts_user_post_uidx" ON "saved_posts"("user_id", "post_id");
CREATE INDEX IF NOT EXISTS "saved_posts_post_id_idx" ON "saved_posts"("post_id");

CREATE TABLE IF NOT EXISTS "saved_articles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "profiles"("user_id") ON DELETE CASCADE,
  "article_id" UUID NOT NULL REFERENCES "articles"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "saved_articles_user_article_uidx" ON "saved_articles"("user_id", "article_id");
CREATE INDEX IF NOT EXISTS "saved_articles_article_id_idx" ON "saved_articles"("article_id");

CREATE TABLE IF NOT EXISTS "outbox_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID REFERENCES "profiles"("user_id") ON DELETE SET NULL,
  "event_type" VARCHAR(64) NOT NULL,
  "aggregate_id" VARCHAR(64),
  "payload" JSONB NOT NULL DEFAULT '{}',
  "status" VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "processed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "outbox_events_status_created_idx" ON "outbox_events"("status", "created_at");
CREATE INDEX IF NOT EXISTS "outbox_events_user_event_idx" ON "outbox_events"("user_id", "event_type");

CREATE TABLE IF NOT EXISTS "privacy_jobs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "profiles"("user_id") ON DELETE CASCADE,
  "job_type" VARCHAR(32) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  "result_url" TEXT,
  "expires_at" TIMESTAMPTZ,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "privacy_jobs_user_type_created_idx"
  ON "privacy_jobs"("user_id", "job_type", "created_at" DESC);

-- parent_comment_id if post_comments already existed without it
DO $$ BEGIN
  ALTER TABLE "post_comments" ADD COLUMN IF NOT EXISTS "parent_comment_id" UUID;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'post_comments_parent_comment_id_fkey'
  ) THEN
    ALTER TABLE "post_comments"
      ADD CONSTRAINT "post_comments_parent_comment_id_fkey"
      FOREIGN KEY ("parent_comment_id") REFERENCES "post_comments"("id") ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
WHEN undefined_table THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS "post_comments_parent_comment_id_idx" ON "post_comments"("parent_comment_id");
