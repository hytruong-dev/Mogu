ALTER TABLE dish_ingredients
  ADD COLUMN IF NOT EXISTS parsed_name VARCHAR(200);
