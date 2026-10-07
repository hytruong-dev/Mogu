-- AlterTable
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "target_weight_kg" DOUBLE PRECISION;

-- Đồng bộ catalog ưu tiên chọn món với mobile (HEALTHY/ECONOMY/QUICK/NOVELTY)
INSERT INTO "selection_priority_catalog" ("code", "name", "display_order")
VALUES
  ('HEALTHY', 'Lành mạnh', 1),
  ('ECONOMY', 'Tiết kiệm', 2),
  ('QUICK', 'Nhanh gọn', 3),
  ('NOVELTY', 'Thử món mới', 4)
ON CONFLICT ("code") DO UPDATE
  SET "name" = EXCLUDED."name",
      "display_order" = EXCLUDED."display_order",
      "active" = TRUE;

UPDATE "selection_priority_catalog"
SET "active" = FALSE
WHERE "code" IN ('PRICE', 'TIME', 'HEALTH', 'TASTE');
