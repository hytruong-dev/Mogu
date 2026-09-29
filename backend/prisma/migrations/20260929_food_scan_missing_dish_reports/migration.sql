-- Queue of scanned dishes that are not in the catalog, for admins to add.
CREATE TABLE IF NOT EXISTS food_scan_missing_dish_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_event_id uuid,
  user_id uuid,
  image_bucket text,
  image_storage_key text,
  image_phash text,
  recognized_name text,
  guesses jsonb NOT NULL DEFAULT '[]'::jsonb,
  category text,
  cuisine text,
  visible_ingredients jsonb NOT NULL DEFAULT '[]'::jsonb,
  suggested_dish_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL DEFAULT 'AUTO',
  status text NOT NULL DEFAULT 'NEW',
  report_count integer NOT NULL DEFAULT 1,
  linked_dish_id uuid REFERENCES dishes(id) ON DELETE SET NULL,
  handled_by uuid,
  handled_at timestamptz(6),
  admin_note text,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT food_scan_missing_dish_reports_source_chk CHECK (source IN ('AUTO', 'USER')),
  CONSTRAINT food_scan_missing_dish_reports_status_chk CHECK (status IN ('NEW', 'IN_PROGRESS', 'ADDED', 'DISMISSED'))
);

CREATE INDEX IF NOT EXISTS food_scan_missing_dish_reports_status_idx
  ON food_scan_missing_dish_reports (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS food_scan_missing_dish_reports_phash_idx
  ON food_scan_missing_dish_reports (image_phash) WHERE image_phash IS NOT NULL;
CREATE INDEX IF NOT EXISTS food_scan_missing_dish_reports_scan_idx
  ON food_scan_missing_dish_reports (scan_event_id);
