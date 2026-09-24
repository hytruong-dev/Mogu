-- Explore engagement + comment likes + post tags + article schedule
ALTER TYPE "article_status" ADD VALUE IF NOT EXISTS 'SCHEDULED';

ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "publish_at" TIMESTAMPTZ(6);
CREATE INDEX IF NOT EXISTS "articles_status_publish_at_idx" ON "articles"("status", "publish_at");

CREATE TABLE IF NOT EXISTS "explore_engagement_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "content_type" VARCHAR(32) NOT NULL,
  "content_id" UUID NOT NULL,
  "event_type" VARCHAR(32) NOT NULL,
  "dwell_ms" INTEGER,
  "ranking_token" VARCHAR(191),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "explore_engagement_events_user_id_created_at_idx"
  ON "explore_engagement_events"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "explore_engagement_events_content_type_content_id_idx"
  ON "explore_engagement_events"("content_type", "content_id");

CREATE TABLE IF NOT EXISTS "post_tags" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "post_id" UUID NOT NULL REFERENCES "community_posts"("id") ON DELETE CASCADE,
  "tag" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "post_tags_post_id_tag_key" UNIQUE ("post_id", "tag")
);
CREATE INDEX IF NOT EXISTS "post_tags_tag_idx" ON "post_tags"("tag");

CREATE TABLE IF NOT EXISTS "post_comment_likes" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "comment_id" UUID NOT NULL REFERENCES "post_comments"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "post_comment_likes_comment_id_user_id_key" UNIQUE ("comment_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "post_comment_likes_user_id_idx" ON "post_comment_likes"("user_id");

CREATE TABLE IF NOT EXISTS "article_comment_likes" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "comment_id" UUID NOT NULL REFERENCES "article_comments"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "article_comment_likes_comment_id_user_id_key" UNIQUE ("comment_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "article_comment_likes_user_id_idx" ON "article_comment_likes"("user_id");
