-- Explore UX: community composer, media, places, hide, moderation, feedback

CREATE TYPE "post_visibility" AS ENUM ('PUBLIC', 'FOLLOWERS', 'PRIVATE');
CREATE TYPE "community_media_status" AS ENUM ('UPLOAD_PENDING', 'PROCESSING', 'READY', 'REJECTED', 'FAILED', 'DELETED');
CREATE TYPE "hidden_content_type" AS ENUM ('COMMUNITY_POST', 'DISH', 'ARTICLE');
CREATE TYPE "moderation_target_type" AS ENUM ('COMMUNITY_POST', 'COMMENT', 'USER');
CREATE TYPE "moderation_report_status" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED', 'REJECTED');
CREATE TYPE "recommendation_feedback_action" AS ENUM ('NOT_INTERESTED', 'MORE_LIKE_THIS', 'LESS_LIKE_THIS', 'HIDE_AUTHOR', 'WHY_THIS');

CREATE TABLE "places" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider" VARCHAR(32) NOT NULL DEFAULT 'LOCAL',
  "provider_place_id" VARCHAR(191),
  "name" VARCHAR(200) NOT NULL,
  "address_short" VARCHAR(300),
  "lat" DECIMAL(10,7),
  "lng" DECIMAL(10,7),
  "thumbnail_url" TEXT,
  "is_verified" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX "places_provider_provider_place_id_key" ON "places"("provider", "provider_place_id");
CREATE INDEX "places_name_idx" ON "places"("name");

CREATE TABLE "community_media" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_id" UUID NOT NULL,
  "bucket" VARCHAR(64) NOT NULL DEFAULT 'community-media',
  "object_key" VARCHAR(512) NOT NULL,
  "mime_type" VARCHAR(64) NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "checksum" VARCHAR(128),
  "public_url" TEXT,
  "alt_text" VARCHAR(300),
  "status" "community_media_status" NOT NULL DEFAULT 'UPLOAD_PENDING',
  "expires_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "community_media_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("user_id") ON DELETE CASCADE
);
CREATE INDEX "community_media_owner_id_status_idx" ON "community_media"("owner_id", "status");

ALTER TABLE "community_posts"
  ADD COLUMN IF NOT EXISTS "visibility" "post_visibility" NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN IF NOT EXISTS "comments_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "dish_id" UUID,
  ADD COLUMN IF NOT EXISTS "place_id" UUID,
  ADD COLUMN IF NOT EXISTS "client_request_id" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "community_posts_client_request_id_key" ON "community_posts"("client_request_id");
CREATE INDEX IF NOT EXISTS "community_posts_status_visibility_created_at_idx" ON "community_posts"("status", "visibility", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "community_posts_dish_id_idx" ON "community_posts"("dish_id");
CREATE INDEX IF NOT EXISTS "community_posts_place_id_idx" ON "community_posts"("place_id");

ALTER TABLE "community_posts"
  ADD CONSTRAINT "community_posts_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "community_posts_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE SET NULL;

CREATE TABLE "community_post_media" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "post_id" UUID NOT NULL,
  "media_id" UUID NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "alt_text" VARCHAR(300),
  CONSTRAINT "community_post_media_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "community_posts"("id") ON DELETE CASCADE,
  CONSTRAINT "community_post_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "community_media"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "community_post_media_post_id_media_id_key" ON "community_post_media"("post_id", "media_id");
CREATE INDEX "community_post_media_post_id_sort_order_idx" ON "community_post_media"("post_id", "sort_order");

CREATE TABLE "hidden_contents" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "content_type" "hidden_content_type" NOT NULL,
  "content_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "hidden_contents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("user_id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "hidden_contents_user_id_content_type_content_id_key" ON "hidden_contents"("user_id", "content_type", "content_id");
CREATE INDEX "hidden_contents_user_id_created_at_idx" ON "hidden_contents"("user_id", "created_at" DESC);

CREATE TABLE "moderation_reports" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "reporter_id" UUID NOT NULL,
  "target_type" "moderation_target_type" NOT NULL,
  "target_id" UUID NOT NULL,
  "reason_code" VARCHAR(64) NOT NULL,
  "note" TEXT,
  "status" "moderation_report_status" NOT NULL DEFAULT 'OPEN',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "moderation_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "profiles"("user_id") ON DELETE CASCADE
);
CREATE INDEX "moderation_reports_reporter_target_idx" ON "moderation_reports"("reporter_id", "target_type", "target_id");
CREATE INDEX "moderation_reports_status_created_at_idx" ON "moderation_reports"("status", "created_at");

CREATE TABLE "recommendation_feedback" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "content_type" "hidden_content_type" NOT NULL,
  "content_id" UUID NOT NULL,
  "action" "recommendation_feedback_action" NOT NULL,
  "ranking_token" VARCHAR(191),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "recommendation_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("user_id") ON DELETE CASCADE
);
CREATE INDEX "recommendation_feedback_user_id_created_at_idx" ON "recommendation_feedback"("user_id", "created_at" DESC);
CREATE INDEX "recommendation_feedback_content_idx" ON "recommendation_feedback"("content_type", "content_id");
