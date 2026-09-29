-- Stored normalized fields, maintained by a trigger: unaccent is STABLE, not IMMUTABLE.
-- Do not declare an immutable wrapper or index unaccent() expressions.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE dishes ADD COLUMN food_scan_name_folded text NOT NULL DEFAULT '';
ALTER TABLE dishes ADD COLUMN food_scan_search_folded text NOT NULL DEFAULT '';

CREATE FUNCTION update_food_scan_search_fields() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.food_scan_name_folded := lower(unaccent(NEW.name));
  NEW.food_scan_search_folded := lower(unaccent(COALESCE(NEW.search_text, '')));
  RETURN NEW;
END;
$$;

CREATE TRIGGER dishes_food_scan_search_fields
BEFORE INSERT OR UPDATE OF name, search_text ON dishes
FOR EACH ROW EXECUTE FUNCTION update_food_scan_search_fields();

UPDATE dishes SET food_scan_name_folded = lower(unaccent(name)),
  food_scan_search_folded = lower(unaccent(COALESCE(search_text, '')));

CREATE INDEX dishes_food_scan_name_trgm_idx ON dishes USING gin (food_scan_name_folded gin_trgm_ops)
WHERE status = 'PUBLISHED' AND deleted_at IS NULL;
CREATE INDEX dishes_food_scan_search_trgm_idx ON dishes USING gin (food_scan_search_folded gin_trgm_ops)
WHERE status = 'PUBLISHED' AND deleted_at IS NULL;
