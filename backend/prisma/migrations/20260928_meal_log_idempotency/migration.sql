ALTER TABLE "diary_meal_logs"
  ADD COLUMN "idempotency_key" VARCHAR(128),
  ADD COLUMN "request_hash" VARCHAR(64);

-- PostgreSQL permits multiple NULL keys, preserving unkeyed diary creates.
CREATE UNIQUE INDEX "diary_meal_logs_user_id_idempotency_key_key"
  ON "diary_meal_logs"("user_id", "idempotency_key");
