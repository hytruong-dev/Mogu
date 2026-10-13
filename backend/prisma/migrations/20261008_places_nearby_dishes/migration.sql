-- Location-based random + nearby places (rating, giá, giờ mở) + liên kết quán ↔ món
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "places"
  ADD COLUMN IF NOT EXISTS "rating_avg" DECIMAL(3,2),
  ADD COLUMN IF NOT EXISTS "rating_count" INTEGER,
  ADD COLUMN IF NOT EXISTS "price_min" INTEGER,
  ADD COLUMN IF NOT EXISTS "price_max" INTEGER,
  ADD COLUMN IF NOT EXISTS "opening_hours" JSONB,
  ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "category_tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "source_url" TEXT,
  ADD COLUMN IF NOT EXISTS "source_meta" JSONB,
  ADD COLUMN IF NOT EXISTS "last_synced_at" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "places_lat_lng_idx" ON "places" ("lat", "lng");

DO $$ BEGIN
  CREATE TYPE "place_dish_match_status" AS ENUM ('CONFIRMED', 'LIKELY', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "place_dishes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "place_id" UUID NOT NULL,
  "dish_id" UUID NOT NULL,
  "match_status" "place_dish_match_status" NOT NULL DEFAULT 'LIKELY',
  "source_item_name" VARCHAR(300),
  "price_vnd" INTEGER,
  "match_score" DECIMAL(4,3),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "place_dishes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "place_dishes_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "place_dishes_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "place_dishes_place_id_dish_id_key" ON "place_dishes" ("place_id", "dish_id");
CREATE INDEX IF NOT EXISTS "place_dishes_dish_id_idx" ON "place_dishes" ("dish_id");

-- Khoảng cách haversine (mét) — dùng trong truy vấn quán gần, không cần PostGIS
CREATE OR REPLACE FUNCTION haversine_m(lat1 DOUBLE PRECISION, lng1 DOUBLE PRECISION, lat2 DOUBLE PRECISION, lng2 DOUBLE PRECISION)
RETURNS DOUBLE PRECISION
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT 6371000 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;
