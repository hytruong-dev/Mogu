-- AlterTable
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "is_pinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "featured_at" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "articles_is_pinned_status_created_at_idx" ON "articles"("is_pinned", "status", "created_at" DESC);

-- CreateTable
CREATE TABLE IF NOT EXISTS "explore_feed_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "item_keys" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "explore_feed_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "explore_feed_sessions_expires_at_idx" ON "explore_feed_sessions"("expires_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "explore_feed_sessions_user_id_created_at_idx" ON "explore_feed_sessions"("user_id", "created_at" DESC);
