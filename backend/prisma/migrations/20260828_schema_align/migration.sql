-- Schema align: Prisma models dish_nutrition, recipe_steps.dish_id, dish_sources
-- Chạy sau BA-004 nếu DB còn schema cũ (nutrition_profiles, recipe_id)

ALTER TABLE recipe_steps
  ADD COLUMN IF NOT EXISTS dish_id UUID REFERENCES dishes(id) ON DELETE CASCADE;

ALTER TABLE recipe_steps DROP COLUMN IF EXISTS recipe_id;

CREATE INDEX IF NOT EXISTS idx_recipe_steps_dish_id ON recipe_steps(dish_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recipe_steps_dish_id_step_order_key'
  ) THEN
    ALTER TABLE recipe_steps
      ADD CONSTRAINT recipe_steps_dish_id_step_order_key UNIQUE (dish_id, step_order);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS dish_nutrition (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id      UUID UNIQUE NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  calories     NUMERIC(8,2),
  protein_g    NUMERIC(8,2),
  carbs_g      NUMERIC(8,2),
  fat_g        NUMERIC(8,2),
  fiber_g      NUMERIC(8,2),
  sodium_mg    NUMERIC(10,2),
  serving_name VARCHAR(100) DEFAULT '1 phần',
  serving_g    NUMERIC(8,2),
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dish_nutrition_dish_id ON dish_nutrition(dish_id);

DO $$ BEGIN
  CREATE TYPE import_source_type AS ENUM ('JSON_LD', 'VIDEO', 'NUTRITION', 'UNSTRUCTURED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS dish_sources (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id     UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  domain      VARCHAR(200),
  title       VARCHAR(300),
  author      VARCHAR(200),
  source_type import_source_type NOT NULL DEFAULT 'UNSTRUCTURED',
  reliability INT NOT NULL DEFAULT 50 CHECK (reliability BETWEEN 0 AND 100),
  accessed_at TIMESTAMPTZ,
  is_stale    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ds_dish_id_idx ON dish_sources(dish_id);
