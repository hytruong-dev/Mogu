-- Cache ô lưới đã làm nóng dữ liệu quán quanh người dùng (random theo vị trí, ràng buộc cứng bán kính)
CREATE TABLE IF NOT EXISTS "place_area_cells" (
  "cell_key"    VARCHAR(64) NOT NULL,
  "lat"         DECIMAL(10,7) NOT NULL,
  "lng"         DECIMAL(10,7) NOT NULL,
  "radius_m"    INTEGER NOT NULL,
  "source"      VARCHAR(16),
  "place_count" INTEGER NOT NULL DEFAULT 0,
  "link_count"  INTEGER NOT NULL DEFAULT 0,
  "expires_at"  TIMESTAMPTZ(6) NOT NULL,
  "fetched_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "place_area_cells_pkey" PRIMARY KEY ("cell_key")
);

CREATE INDEX IF NOT EXISTS "place_area_cells_expires_at_idx" ON "place_area_cells" ("expires_at");

-- Tra cứu nhanh liên kết quán ↔ món theo chất lượng match (random chỉ nhận match_score >= 0.6)
CREATE INDEX IF NOT EXISTS "place_dishes_place_id_match_status_idx" ON "place_dishes" ("place_id", "match_status");
