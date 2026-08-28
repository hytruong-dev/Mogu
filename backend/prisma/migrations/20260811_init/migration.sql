-- Migration: init (v2.0)
-- Mogu Backend — Full schema including onboarding tables
-- Generated manually for Supabase PostgreSQL

-- ─────────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE "account_status" AS ENUM (
  'PENDING_VERIFICATION',
  'ACTIVE',
  'LOCKED',
  'SUSPENDED',
  'DELETED'
);

CREATE TYPE "onboarding_status" AS ENUM (
  'NOT_STARTED',
  'IN_PROGRESS',
  'SKIPPED',
  'COMPLETED'
);

CREATE TYPE "gender" AS ENUM (
  'MALE',
  'FEMALE',
  'OTHER',
  'PREFER_NOT_TO_SAY'
);

CREATE TYPE "goal_priority" AS ENUM (
  'PRIMARY',
  'SECONDARY'
);

CREATE TYPE "dietary_preference_type" AS ENUM (
  'TASTE',
  'DIET'
);

CREATE TYPE "consent_type" AS ENUM (
  'TERMS_OF_SERVICE',
  'PRIVACY_POLICY'
);

CREATE TYPE "audit_event_type" AS ENUM (
  'REGISTER_STARTED',
  'REGISTER_OTP_SENT',
  'REGISTER_OTP_VERIFIED',
  'REGISTER_COMPLETED',
  'LOGIN_SUCCEEDED',
  'LOGIN_FAILED',
  'LOGOUT',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_RESET_COMPLETED',
  'TOKEN_REFRESHED',
  'ACCOUNT_LOCKED',
  'OTP_RESENT'
);

CREATE TYPE "audit_result" AS ENUM (
  'SUCCESS',
  'FAILURE'
);

CREATE TYPE "meal_type" AS ENUM (
  'BREAKFAST',
  'LUNCH',
  'DINNER',
  'SNACK'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "profiles" (
  "id"                UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id"           UUID NOT NULL,
  "display_name"      TEXT,
  "avatar_url"        TEXT,
  "locale"            TEXT NOT NULL DEFAULT 'vi',
  "timezone"          TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  "account_status"    "account_status" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "onboarding_status" "onboarding_status" NOT NULL DEFAULT 'NOT_STARTED',
  "onboarding_step"   INTEGER NOT NULL DEFAULT 0,
  "gender"            "gender",
  "date_of_birth"     DATE,
  "no_allergies"      BOOLEAN NOT NULL DEFAULT false,
  "weight_kg"         DOUBLE PRECISION,
  "height_cm"         DOUBLE PRECISION,
  "goal_kcal"         INTEGER,
  "profile_version"   INTEGER NOT NULL DEFAULT 1,
  "completed_at"      TIMESTAMP(3),
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles"("user_id");

-- ─────────────────────────────────────────────────────────────────────────────
-- onboarding_sessions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "onboarding_sessions" (
  "id"                  UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id"             UUID NOT NULL,
  "onboarding_version"  TEXT NOT NULL DEFAULT '1.0',
  "current_step"        INTEGER NOT NULL DEFAULT 1,
  "status"              "onboarding_status" NOT NULL DEFAULT 'IN_PROGRESS',
  "data_json"           JSONB,
  "completed_at"        TIMESTAMP(3),
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "onboarding_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "onboarding_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "profiles"("user_id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "onboarding_sessions_user_id_key" ON "onboarding_sessions"("user_id");

-- ─────────────────────────────────────────────────────────────────────────────
-- goals (catalog)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "goals" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "code"          TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "description"   TEXT,
  "active"        BOOLEAN NOT NULL DEFAULT true,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "goals_code_key" ON "goals"("code");

-- ─────────────────────────────────────────────────────────────────────────────
-- user_goals
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "user_goals" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    UUID NOT NULL,
  "goal_id"    UUID NOT NULL,
  "priority"   "goal_priority" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_goals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_goals_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "profiles"("user_id") ON DELETE CASCADE,
  CONSTRAINT "user_goals_goal_id_fkey"
    FOREIGN KEY ("goal_id") REFERENCES "goals"("id")
);

CREATE UNIQUE INDEX "user_goals_user_id_goal_id_key" ON "user_goals"("user_id", "goal_id");

-- ─────────────────────────────────────────────────────────────────────────────
-- dietary_preferences (catalog)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "dietary_preferences" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "code"          TEXT NOT NULL,
  "type"          "dietary_preference_type" NOT NULL,
  "name"          TEXT NOT NULL,
  "active"        BOOLEAN NOT NULL DEFAULT true,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "dietary_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "dietary_preferences_code_key" ON "dietary_preferences"("code");

-- ─────────────────────────────────────────────────────────────────────────────
-- user_dietary_preferences
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "user_dietary_preferences" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id"       UUID NOT NULL,
  "preference_id" UUID NOT NULL,
  "strength"      INTEGER NOT NULL DEFAULT 1,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_dietary_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_dietary_preferences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "profiles"("user_id") ON DELETE CASCADE,
  CONSTRAINT "user_dietary_preferences_preference_id_fkey"
    FOREIGN KEY ("preference_id") REFERENCES "dietary_preferences"("id")
);

CREATE UNIQUE INDEX "user_dietary_preferences_user_id_preference_id_key"
  ON "user_dietary_preferences"("user_id", "preference_id");

-- ─────────────────────────────────────────────────────────────────────────────
-- allergens (catalog)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "allergens" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "code"          TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "active"        BOOLEAN NOT NULL DEFAULT true,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "allergens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "allergens_code_key" ON "allergens"("code");

-- ─────────────────────────────────────────────────────────────────────────────
-- user_allergens
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "user_allergens" (
  "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id"      UUID NOT NULL,
  "allergen_id"  UUID NOT NULL,
  "severity"     TEXT,
  "confirmed_at" TIMESTAMP(3),
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_allergens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_allergens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "profiles"("user_id") ON DELETE CASCADE,
  CONSTRAINT "user_allergens_allergen_id_fkey"
    FOREIGN KEY ("allergen_id") REFERENCES "allergens"("id")
);

CREATE UNIQUE INDEX "user_allergens_user_id_allergen_id_key"
  ON "user_allergens"("user_id", "allergen_id");

-- ─────────────────────────────────────────────────────────────────────────────
-- user_avoided_ingredients
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "user_avoided_ingredients" (
  "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id"         UUID NOT NULL,
  "ingredient_name" TEXT NOT NULL,
  "reason"          TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_avoided_ingredients_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_avoided_ingredients_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "profiles"("user_id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "user_avoided_ingredients_user_id_ingredient_name_key"
  ON "user_avoided_ingredients"("user_id", "ingredient_name");

-- ─────────────────────────────────────────────────────────────────────────────
-- user_consents
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "user_consents" (
  "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id"      UUID NOT NULL,
  "consent_type" "consent_type" NOT NULL,
  "version"      TEXT NOT NULL,
  "accepted_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source"       TEXT,

  CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_consents_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "profiles"("user_id") ON DELETE CASCADE
);

-- ─────────────────────────────────────────────────────────────────────────────
-- auth_audit_logs
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "auth_audit_logs" (
  "id"                 UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id"            UUID,
  "event_type"         "audit_event_type" NOT NULL,
  "result"             "audit_result" NOT NULL,
  "correlation_id"     TEXT,
  "ip_hash"            TEXT,
  "device_id_hash"     TEXT,
  "platform"           TEXT,
  "app_version"        TEXT,
  "metadata_sanitized" JSONB,
  "occurred_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "auth_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auth_audit_logs_user_id_idx" ON "auth_audit_logs"("user_id");
CREATE INDEX "auth_audit_logs_occurred_at_idx" ON "auth_audit_logs"("occurred_at");

-- ─────────────────────────────────────────────────────────────────────────────
-- foods
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "foods" (
  "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "image_url"   TEXT,
  "kcal"        INTEGER NOT NULL,
  "protein"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "carb"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "fat"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "tags"        TEXT[] NOT NULL DEFAULT '{}',
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "foods_pkey" PRIMARY KEY ("id")
);

-- ─────────────────────────────────────────────────────────────────────────────
-- meals
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "meals" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    UUID NOT NULL,
  "type"       "meal_type" NOT NULL,
  "date"       DATE NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "meals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "meals_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "profiles"("user_id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "meals_user_id_type_date_key" ON "meals"("user_id", "type", "date");

-- ─────────────────────────────────────────────────────────────────────────────
-- meal_items
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "meal_items" (
  "id"       UUID NOT NULL DEFAULT gen_random_uuid(),
  "meal_id"  UUID NOT NULL,
  "food_id"  UUID NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "grams"    DOUBLE PRECISION,

  CONSTRAINT "meal_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "meal_items_meal_id_fkey"
    FOREIGN KEY ("meal_id") REFERENCES "meals"("id") ON DELETE CASCADE,
  CONSTRAINT "meal_items_food_id_fkey"
    FOREIGN KEY ("food_id") REFERENCES "foods"("id")
);

-- ─────────────────────────────────────────────────────────────────────────────
-- meal_logs
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "meal_logs" (
  "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id"     UUID NOT NULL,
  "meal_id"     UUID NOT NULL,
  "logged_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "total_kcal"  INTEGER NOT NULL,
  "note"        TEXT,

  CONSTRAINT "meal_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "meal_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "profiles"("user_id") ON DELETE CASCADE,
  CONSTRAINT "meal_logs_meal_id_fkey"
    FOREIGN KEY ("meal_id") REFERENCES "meals"("id") ON DELETE CASCADE
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Prisma migration tracking
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "_prisma_migrations" (
  "id", "checksum", "finished_at", "migration_name",
  "logs", "rolled_back_at", "started_at", "applied_steps_count"
)
VALUES (
  gen_random_uuid(),
  'manual',
  now(),
  '20260811_init',
  NULL, NULL, now(), 1
);
