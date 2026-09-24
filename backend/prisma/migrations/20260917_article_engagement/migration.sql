-- Article engagement: likes + comments

ALTER TABLE "articles"
  ADD COLUMN IF NOT EXISTS "like_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "comment_count" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "article_likes" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "article_id" UUID NOT NULL REFERENCES "articles"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "article_likes_article_id_user_id_key" UNIQUE ("article_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "article_likes_user_id_idx" ON "article_likes"("user_id");

CREATE TABLE IF NOT EXISTS "article_comments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "article_id" UUID NOT NULL REFERENCES "articles"("id") ON DELETE CASCADE,
  "author_id" UUID NOT NULL,
  "content" TEXT NOT NULL,
  "parent_comment_id" UUID REFERENCES "article_comments"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "article_comments_article_id_created_at_idx" ON "article_comments"("article_id", "created_at");
CREATE INDEX IF NOT EXISTS "article_comments_author_id_idx" ON "article_comments"("author_id");
CREATE INDEX IF NOT EXISTS "article_comments_parent_comment_id_idx" ON "article_comments"("parent_comment_id");
