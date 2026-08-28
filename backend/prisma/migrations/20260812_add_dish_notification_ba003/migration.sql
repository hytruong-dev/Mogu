-- BA-003: Add Dish, SavedDish, Notification, RecommendationLog
-- Migration: 20260812_add_dish_notification_ba003

-- ── Enums ──────────────────────────────────────────────────────────────────

CREATE TYPE "dish_category" AS ENUM ('RICE', 'NOODLE', 'SOUP', 'SALAD', 'SNACK', 'DRINK', 'OTHER');
CREATE TYPE "notification_status" AS ENUM ('UNREAD', 'READ');
CREATE TYPE "notification_type" AS ENUM ('SYSTEM', 'PROMO', 'REMINDER', 'ACHIEVEMENT');

-- ── Dishes ─────────────────────────────────────────────────────────────────

CREATE TABLE "dishes" (
    "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
    "name"          TEXT        NOT NULL,
    "description"   TEXT,
    "image_url"     TEXT,
    "calories"      INTEGER     NOT NULL DEFAULT 0,
    "prep_minutes"  INTEGER     NOT NULL DEFAULT 0,
    "price_range"   TEXT,
    "category"      "dish_category" NOT NULL DEFAULT 'OTHER',
    "tags"          TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
    "allergen_codes" TEXT[]     NOT NULL DEFAULT ARRAY[]::TEXT[],
    "active"        BOOLEAN     NOT NULL DEFAULT true,
    "display_order" INTEGER     NOT NULL DEFAULT 0,
    "created_at"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dishes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dishes_active_idx" ON "dishes"("active");

-- ── updated_at trigger for dishes ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "dishes_updated_at"
  BEFORE UPDATE ON "dishes"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── SavedDish ──────────────────────────────────────────────────────────────

CREATE TABLE "saved_dishes" (
    "id"       UUID        NOT NULL DEFAULT gen_random_uuid(),
    "user_id"  UUID        NOT NULL,
    "dish_id"  UUID        NOT NULL,
    "saved_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_dishes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "saved_dishes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("user_id") ON DELETE CASCADE,
    CONSTRAINT "saved_dishes_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE CASCADE,
    CONSTRAINT "saved_dishes_user_id_dish_id_key" UNIQUE ("user_id", "dish_id")
);

CREATE INDEX "saved_dishes_user_idx" ON "saved_dishes"("user_id");

-- ── Notifications ──────────────────────────────────────────────────────────

CREATE TABLE "notifications" (
    "id"        UUID                 NOT NULL DEFAULT gen_random_uuid(),
    "user_id"   UUID                 NOT NULL,
    "type"      "notification_type"  NOT NULL,
    "title"     TEXT                 NOT NULL,
    "body"      TEXT                 NOT NULL,
    "deep_link" TEXT,
    "image_url" TEXT,
    "status"    "notification_status" NOT NULL DEFAULT 'UNREAD',
    "read_at"   TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ         NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("user_id") ON DELETE CASCADE
);

CREATE INDEX "notifications_user_status_idx" ON "notifications"("user_id", "status");

-- ── RecommendationLog ──────────────────────────────────────────────────────

CREATE TABLE "recommendation_logs" (
    "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
    "user_id"    UUID        NOT NULL,
    "dish_id"    UUID,
    "event"      TEXT        NOT NULL,
    "position"   INTEGER,
    "session_id" TEXT,
    "goal_code"  TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "recommendation_logs_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE SET NULL
);

CREATE INDEX "rec_logs_user_created_idx" ON "recommendation_logs"("user_id", "created_at");
CREATE INDEX "rec_logs_dish_idx" ON "recommendation_logs"("dish_id");
