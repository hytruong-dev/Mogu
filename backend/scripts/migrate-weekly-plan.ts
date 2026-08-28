/**
 * BA-005: Weekly Meal Plan — Migration Script
 * Runs raw SQL for ENUM types, tables, CHECK constraints, partial unique indexes, RLS.
 * Execute: npx ts-node -r tsconfig-paths/register scripts/migrate-weekly-plan.ts
 */

import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const pool = new (pg.Pool)({ connectionString: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any) as any;

const STEPS: { label: string; sql: string }[] = [
  // ── ENUM types ──────────────────────────────────────────────────────────────
  {
    label: 'enum weekly_plan_status',
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'weekly_plan_status') THEN
        CREATE TYPE "weekly_plan_status" AS ENUM (
          'GENERATING','READY','ACTIVE','COMPLETED','FAILED','CANCELLED','ARCHIVED'
        );
      END IF;
    END $$`,
  },
  {
    label: 'enum weekly_plan_slot_status',
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'weekly_plan_slot_status') THEN
        CREATE TYPE "weekly_plan_slot_status" AS ENUM ('PLANNED','COMPLETED','SKIPPED');
      END IF;
    END $$`,
  },
  {
    label: 'enum weekly_meal_slot',
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'weekly_meal_slot') THEN
        CREATE TYPE "weekly_meal_slot" AS ENUM ('MORNING','LUNCH','DINNER','SNACK');
      END IF;
    END $$`,
  },
  {
    label: 'enum weekly_kcal_mode',
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'weekly_kcal_mode') THEN
        CREATE TYPE "weekly_kcal_mode" AS ENUM ('PROFILE','CUSTOM');
      END IF;
    END $$`,
  },
  {
    label: 'enum weekly_plan_swap_reason',
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'weekly_plan_swap_reason') THEN
        CREATE TYPE "weekly_plan_swap_reason" AS ENUM (
          'USER_REQUEST','REBALANCE_BUDGET','REBALANCE_CALORIES',
          'DISH_UNAVAILABLE','DIET_CONFLICT','OTHER'
        );
      END IF;
    END $$`,
  },

  // ── Tables ───────────────────────────────────────────────────────────────────
  {
    label: 'CREATE TABLE weekly_plan_configs',
    sql: `CREATE TABLE IF NOT EXISTS "weekly_plan_configs" (
      "id"                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id"                   UUID NOT NULL UNIQUE REFERENCES "profiles"("user_id") ON DELETE CASCADE,
      "budget_vnd"                INTEGER NOT NULL,
      "kcal_per_day"              INTEGER NOT NULL,
      "kcal_mode"                 "weekly_kcal_mode" NOT NULL DEFAULT 'PROFILE',
      "duration_days"             INTEGER NOT NULL DEFAULT 7,
      "meals_per_day"             INTEGER NOT NULL DEFAULT 3,
      "enabled_slots"             "weekly_meal_slot"[] NOT NULL DEFAULT ARRAY['MORNING','LUNCH','DINNER']::"weekly_meal_slot"[],
      "avoid_repeat"              BOOLEAN NOT NULL DEFAULT TRUE,
      "prefer_home_cook"          BOOLEAN NOT NULL DEFAULT FALSE,
      "calorie_tolerance_percent" INTEGER NOT NULL DEFAULT 10,
      "created_at"                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updated_at"                TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
  },
  {
    label: 'CREATE TABLE weekly_plans',
    sql: `CREATE TABLE IF NOT EXISTS "weekly_plans" (
      "id"                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id"                UUID NOT NULL REFERENCES "profiles"("user_id") ON DELETE CASCADE,
      "config_id"              UUID NOT NULL REFERENCES "weekly_plan_configs"("id") ON DELETE RESTRICT,
      "start_date"             DATE NOT NULL,
      "end_date"               DATE NOT NULL,
      "status"                 "weekly_plan_status" NOT NULL DEFAULT 'GENERATING',
      "budget_limit_vnd"       INTEGER NOT NULL,
      "projected_cost_vnd"     INTEGER NOT NULL DEFAULT 0,
      "actual_spent_vnd"       INTEGER NOT NULL DEFAULT 0,
      "target_kcal"            INTEGER NOT NULL,
      "projected_kcal"         INTEGER NOT NULL DEFAULT 0,
      "actual_kcal"            INTEGER NOT NULL DEFAULT 0,
      "config_snapshot"        JSONB NOT NULL DEFAULT '{}',
      "profile_snapshot"       JSONB,
      "algorithm_version"      VARCHAR(20) NOT NULL DEFAULT '1.0',
      "generation_error_code"  VARCHAR(100),
      "generation_error_data"  JSONB,
      "started_at"             TIMESTAMPTZ,
      "completed_at"           TIMESTAMPTZ,
      "archived_at"            TIMESTAMPTZ,
      "version"                INTEGER NOT NULL DEFAULT 1,
      "created_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updated_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
  },
  {
    label: 'CREATE TABLE weekly_plan_slots',
    sql: `CREATE TABLE IF NOT EXISTS "weekly_plan_slots" (
      "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "plan_id"             UUID NOT NULL REFERENCES "weekly_plans"("id") ON DELETE CASCADE,
      "dish_id"             UUID NOT NULL REFERENCES "dishes"("id") ON DELETE RESTRICT,
      "date"                DATE NOT NULL,
      "meal_slot"           "weekly_meal_slot" NOT NULL,
      "status"              "weekly_plan_slot_status" NOT NULL DEFAULT 'PLANNED',
      "servings"            DECIMAL(6,2) NOT NULL DEFAULT 1,
      "is_locked"           BOOLEAN NOT NULL DEFAULT FALSE,
      "swap_count"          INTEGER NOT NULL DEFAULT 0,
      "dish_name_snapshot"  VARCHAR(150) NOT NULL,
      "image_url_snapshot"  TEXT,
      "price_snapshot_vnd"  INTEGER NOT NULL,
      "kcal_snapshot"       INTEGER NOT NULL,
      "protein_g_snapshot"  DECIMAL(8,2),
      "carbs_g_snapshot"    DECIMAL(8,2),
      "fat_g_snapshot"      DECIMAL(8,2),
      "score_snapshot"      JSONB,
      "reason_snapshot"     JSONB,
      "actual_cost_vnd"     INTEGER,
      "actual_kcal"         INTEGER,
      "completed_at"        TIMESTAMPTZ,
      "skipped_at"          TIMESTAMPTZ,
      "version"             INTEGER NOT NULL DEFAULT 1,
      "created_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE ("plan_id", "date", "meal_slot")
    )`,
  },
  {
    label: 'CREATE TABLE weekly_plan_slot_swaps',
    sql: `CREATE TABLE IF NOT EXISTS "weekly_plan_slot_swaps" (
      "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "slot_id"           UUID NOT NULL REFERENCES "weekly_plan_slots"("id") ON DELETE CASCADE,
      "previous_dish_id"  UUID NOT NULL,
      "new_dish_id"       UUID NOT NULL,
      "previous_cost_vnd" INTEGER NOT NULL,
      "new_cost_vnd"      INTEGER NOT NULL,
      "previous_kcal"     INTEGER NOT NULL,
      "new_kcal"          INTEGER NOT NULL,
      "reason"            "weekly_plan_swap_reason" NOT NULL DEFAULT 'USER_REQUEST',
      "score_snapshot"    JSONB,
      "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
  },

  // ── CHECK constraints ─────────────────────────────────────────────────────────
  {
    label: 'CHECK budget_vnd > 0',
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_wpc_budget_positive') THEN
        ALTER TABLE "weekly_plan_configs"
          ADD CONSTRAINT "chk_wpc_budget_positive" CHECK ("budget_vnd" > 0);
      END IF;
    END $$`,
  },
  {
    label: 'CHECK kcal_per_day range',
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_wpc_kcal_range') THEN
        ALTER TABLE "weekly_plan_configs"
          ADD CONSTRAINT "chk_wpc_kcal_range" CHECK ("kcal_per_day" BETWEEN 800 AND 5000);
      END IF;
    END $$`,
  },
  {
    label: 'CHECK duration_days IN (3,5,7,14)',
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_wpc_duration') THEN
        ALTER TABLE "weekly_plan_configs"
          ADD CONSTRAINT "chk_wpc_duration" CHECK ("duration_days" IN (3, 5, 7, 14));
      END IF;
    END $$`,
  },
  {
    label: 'CHECK end_date > start_date',
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_wp_date_range') THEN
        ALTER TABLE "weekly_plans"
          ADD CONSTRAINT "chk_wp_date_range" CHECK ("end_date" > "start_date");
      END IF;
    END $$`,
  },

  // ── Partial unique indexes ────────────────────────────────────────────────────
  {
    label: 'partial idx: one ACTIVE plan per user',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "weekly_plans_one_active_per_user_idx"
      ON "weekly_plans" ("user_id") WHERE status = 'ACTIVE'`,
  },
  {
    label: 'partial idx: one GENERATING plan per user',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "weekly_plans_one_generating_per_user_idx"
      ON "weekly_plans" ("user_id") WHERE status = 'GENERATING'`,
  },

  // ── Regular indexes ───────────────────────────────────────────────────────────
  {
    label: 'idx weekly_plans user+status',
    sql: `CREATE INDEX IF NOT EXISTS "idx_weekly_plans_user_status" ON "weekly_plans" ("user_id", "status")`,
  },
  {
    label: 'idx weekly_plans user+start_date',
    sql: `CREATE INDEX IF NOT EXISTS "idx_weekly_plans_user_start_date" ON "weekly_plans" ("user_id", "start_date" DESC)`,
  },
  {
    label: 'idx weekly_plan_slots plan+date',
    sql: `CREATE INDEX IF NOT EXISTS "idx_weekly_plan_slots_plan_date" ON "weekly_plan_slots" ("plan_id", "date")`,
  },
  {
    label: 'idx weekly_plan_slots dish',
    sql: `CREATE INDEX IF NOT EXISTS "idx_weekly_plan_slots_dish" ON "weekly_plan_slots" ("dish_id")`,
  },
  {
    label: 'idx weekly_plan_slot_swaps slot+created_at',
    sql: `CREATE INDEX IF NOT EXISTS "idx_weekly_plan_slot_swaps_slot" ON "weekly_plan_slot_swaps" ("slot_id", "created_at" DESC)`,
  },

  // ── updated_at trigger function ───────────────────────────────────────────────
  {
    label: 'create/replace set_updated_at function',
    sql: `CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql`,
  },

  // ── Triggers ──────────────────────────────────────────────────────────────────
  {
    label: 'trigger weekly_plan_configs',
    sql: `DO $$ BEGIN
      DROP TRIGGER IF EXISTS "trg_weekly_plan_configs_updated_at" ON "weekly_plan_configs";
      CREATE TRIGGER "trg_weekly_plan_configs_updated_at"
        BEFORE UPDATE ON "weekly_plan_configs"
        FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
    END $$`,
  },
  {
    label: 'trigger weekly_plans',
    sql: `DO $$ BEGIN
      DROP TRIGGER IF EXISTS "trg_weekly_plans_updated_at" ON "weekly_plans";
      CREATE TRIGGER "trg_weekly_plans_updated_at"
        BEFORE UPDATE ON "weekly_plans"
        FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
    END $$`,
  },
  {
    label: 'trigger weekly_plan_slots',
    sql: `DO $$ BEGIN
      DROP TRIGGER IF EXISTS "trg_weekly_plan_slots_updated_at" ON "weekly_plan_slots";
      CREATE TRIGGER "trg_weekly_plan_slots_updated_at"
        BEFORE UPDATE ON "weekly_plan_slots"
        FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
    END $$`,
  },

  // ── Row Level Security ────────────────────────────────────────────────────────
  { label: 'RLS enable weekly_plan_configs', sql: `ALTER TABLE "weekly_plan_configs" ENABLE ROW LEVEL SECURITY` },
  { label: 'RLS enable weekly_plans', sql: `ALTER TABLE "weekly_plans" ENABLE ROW LEVEL SECURITY` },
  { label: 'RLS enable weekly_plan_slots', sql: `ALTER TABLE "weekly_plan_slots" ENABLE ROW LEVEL SECURITY` },
  { label: 'RLS enable weekly_plan_slot_swaps', sql: `ALTER TABLE "weekly_plan_slot_swaps" ENABLE ROW LEVEL SECURITY` },

  {
    label: 'RLS policy wpc_select_own',
    sql: `DO $$ BEGIN
      DROP POLICY IF EXISTS "wpc_select_own" ON "weekly_plan_configs";
      CREATE POLICY "wpc_select_own" ON "weekly_plan_configs"
        FOR SELECT USING (auth.uid() = user_id);
    END $$`,
  },
  {
    label: 'RLS policy wpc_insert_own',
    sql: `DO $$ BEGIN
      DROP POLICY IF EXISTS "wpc_insert_own" ON "weekly_plan_configs";
      CREATE POLICY "wpc_insert_own" ON "weekly_plan_configs"
        FOR INSERT WITH CHECK (auth.uid() = user_id);
    END $$`,
  },
  {
    label: 'RLS policy wpc_update_own',
    sql: `DO $$ BEGIN
      DROP POLICY IF EXISTS "wpc_update_own" ON "weekly_plan_configs";
      CREATE POLICY "wpc_update_own" ON "weekly_plan_configs"
        FOR UPDATE USING (auth.uid() = user_id);
    END $$`,
  },
  {
    label: 'RLS policy wp_select_own',
    sql: `DO $$ BEGIN
      DROP POLICY IF EXISTS "wp_select_own" ON "weekly_plans";
      CREATE POLICY "wp_select_own" ON "weekly_plans"
        FOR SELECT USING (auth.uid() = user_id);
    END $$`,
  },
  {
    label: 'RLS policy wp_insert_own',
    sql: `DO $$ BEGIN
      DROP POLICY IF EXISTS "wp_insert_own" ON "weekly_plans";
      CREATE POLICY "wp_insert_own" ON "weekly_plans"
        FOR INSERT WITH CHECK (auth.uid() = user_id);
    END $$`,
  },
  {
    label: 'RLS policy wp_update_own',
    sql: `DO $$ BEGIN
      DROP POLICY IF EXISTS "wp_update_own" ON "weekly_plans";
      CREATE POLICY "wp_update_own" ON "weekly_plans"
        FOR UPDATE USING (auth.uid() = user_id);
    END $$`,
  },
  {
    label: 'RLS policy wps_select_own',
    sql: `DO $$ BEGIN
      DROP POLICY IF EXISTS "wps_select_own" ON "weekly_plan_slots";
      CREATE POLICY "wps_select_own" ON "weekly_plan_slots"
        FOR SELECT USING (
          EXISTS (SELECT 1 FROM "weekly_plans" wp WHERE wp.id = plan_id AND wp.user_id = auth.uid())
        );
    END $$`,
  },
  {
    label: 'RLS policy wps_update_own',
    sql: `DO $$ BEGIN
      DROP POLICY IF EXISTS "wps_update_own" ON "weekly_plan_slots";
      CREATE POLICY "wps_update_own" ON "weekly_plan_slots"
        FOR UPDATE USING (
          EXISTS (SELECT 1 FROM "weekly_plans" wp WHERE wp.id = plan_id AND wp.user_id = auth.uid())
        );
    END $$`,
  },
];

async function main() {
  console.log(`Running ${STEPS.length} migration steps...\n`);
  let ok = 0;
  let fail = 0;

  for (const step of STEPS) {
    try {
      await prisma.$executeRawUnsafe(step.sql);
      console.log(`  ✓ ${step.label}`);
      ok++;
    } catch (err: any) {
      console.error(`  ✗ ${step.label}: ${err.message}`);
      fail++;
    }
  }

  console.log(`\nDone: ${ok} succeeded, ${fail} failed.`);
  await prisma.$disconnect();
  await pool.end();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
});
