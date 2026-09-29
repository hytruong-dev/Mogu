CREATE EXTENSION IF NOT EXISTS vector;

-- Vector embeddings (512-dim normalized vectors from CLIP ViT-B/32)
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS food_scan_text_embedding vector(512);
ALTER TABLE dish_media ADD COLUMN IF NOT EXISTS image_embedding vector(512);

-- Partial HNSW indexes with cosine similarity
CREATE INDEX IF NOT EXISTS dishes_food_scan_text_hnsw_idx
ON dishes USING hnsw (food_scan_text_embedding vector_cosine_ops)
WHERE status = 'PUBLISHED' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS dish_media_image_hnsw_idx
ON dish_media USING hnsw (image_embedding vector_cosine_ops)
WHERE moderation_status = 'APPROVED';

-- Food scan feedback & search events table
CREATE TABLE IF NOT EXISTS food_scan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  image_phash text,
  extraction jsonb,
  shortlist jsonb,
  result_status text,
  chosen_dish_id uuid REFERENCES dishes(id) ON DELETE SET NULL,
  correct boolean,
  confirmed_at timestamptz(6),
  model text,
  latency_ms integer,
  created_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS food_scan_events_phash_idx ON food_scan_events (image_phash) WHERE image_phash IS NOT NULL AND chosen_dish_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS food_scan_events_user_idx ON food_scan_events (user_id);
