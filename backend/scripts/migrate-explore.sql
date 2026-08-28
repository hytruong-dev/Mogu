-- ─────────────────────────────────────────────────────────────────────────────
-- BA-005 Explore Feature Migration
-- Thêm: topics, articles, article_tags, community_posts, post_likes, post_comments
-- ─────────────────────────────────────────────────────────────────────────────

-- Enums
DO $$ BEGIN
  CREATE TYPE article_status AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE post_status AS ENUM ('ACTIVE', 'HIDDEN', 'DELETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Topics
CREATE TABLE IF NOT EXISTS topics (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           VARCHAR(120) NOT NULL UNIQUE,
  title          VARCHAR(200) NOT NULL,
  description    TEXT,
  cover_image_url TEXT,
  display_order  INT NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_topics_active_order ON topics (is_active, display_order);

-- Articles
CREATE TABLE IF NOT EXISTS articles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           VARCHAR(200) NOT NULL UNIQUE,
  title          VARCHAR(300) NOT NULL,
  summary        TEXT,
  content        TEXT NOT NULL,
  cover_image_url TEXT,
  status         article_status NOT NULL DEFAULT 'DRAFT',
  read_minutes   INT NOT NULL DEFAULT 3,
  view_count     INT NOT NULL DEFAULT 0,
  author_id      UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  topic_id       UUID REFERENCES topics(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_articles_status_created ON articles (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_topic ON articles (topic_id);
CREATE INDEX IF NOT EXISTS idx_articles_author ON articles (author_id);

-- Article Tags
CREATE TABLE IF NOT EXISTS article_tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tag        VARCHAR(60) NOT NULL,
  UNIQUE (article_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_article_tags_tag ON article_tags (tag);

-- Community Posts
CREATE TABLE IF NOT EXISTS community_posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  image_urls    TEXT[] NOT NULL DEFAULT '{}',
  status        post_status NOT NULL DEFAULT 'ACTIVE',
  like_count    INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_community_posts_status_created ON community_posts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_author ON community_posts (author_id);

-- Post Likes
CREATE TABLE IF NOT EXISTS post_likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_post_likes_user ON post_likes (user_id);

-- Post Comments
CREATE TABLE IF NOT EXISTS post_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments (post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_post_comments_author ON post_comments (author_id);

-- updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_topics_updated_at BEFORE UPDATE ON topics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_articles_updated_at BEFORE UPDATE ON articles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_community_posts_updated_at BEFORE UPDATE ON community_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_post_comments_updated_at BEFORE UPDATE ON post_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
