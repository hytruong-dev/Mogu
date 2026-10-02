-- Chống trùng nguyên liệu: bật pg_trgm để tìm ứng viên gần giống trong DB
-- (similarity trên search_folded) và index GIN cho synonyms.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram index cho fuzzy lookup theo tên không dấu.
CREATE INDEX IF NOT EXISTS ingredients_search_folded_trgm_idx
ON ingredients USING gin (search_folded gin_trgm_ops);

-- GIN trên mảng synonyms để tra "tên có nằm trong synonyms của NL nào" nhanh.
CREATE INDEX IF NOT EXISTS ingredients_synonyms_gin_idx
ON ingredients USING gin (synonyms);
