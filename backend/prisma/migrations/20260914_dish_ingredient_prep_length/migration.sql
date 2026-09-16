-- Expand dish_ingredients.preparation to fit AI/admin prep notes (was VARCHAR(100)).
ALTER TABLE "dish_ingredients"
  ALTER COLUMN "preparation" TYPE VARCHAR(500);
