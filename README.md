# Mogu — Runbook

Local stack for **Random (BA-006)** + **Weekly Plan (BA-005)** and the rest of the monorepo.

## Prerequisites

- Node.js 20+
- PostgreSQL (Supabase local or remote)
- Optional: Redis (`REDIS_URL`) for async weekly-plan generation via BullMQ  
  Without Redis, generation runs **synchronously** in the API process.

## Environment

Copy backend env templates and set at least:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Prisma / Nest DB |
| `DIRECT_DATABASE_URL` | Migrations (bypass pooler if needed) |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / service role as needed | Auth + media URLs |
| `REDIS_URL` | Optional queue |
| `JWT` / Supabase JWT secrets | Auth |

Mobile: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL` (no hardcoded Supabase host in clients).

## Database migrate

```bash
cd backend
npm install
npx prisma migrate deploy
# or develop: npx prisma migrate dev
```

Weekly meal plan tables ship in `prisma/migrations/20260911_weekly_meal_plan/`.  
Legacy one-off script `scripts/migrate-weekly-plan.ts` is superseded — prefer Prisma migrate on empty DBs.

## Run backend

```bash
cd backend
npm run start:dev
```

## Run mobile

```bash
cd mobile
npm install
npx expo start
```

## Run admin (optional)

```bash
cd admin
npm install
npm run dev
```

## Constraints ADR

See [docs/adr/ADR-RANDOM-WEEKLY-CONSTRAINTS.md](docs/adr/ADR-RANDOM-WEEKLY-CONSTRAINTS.md) (BR-01–BR-05). Hard health filters are never relaxed.

## Tests (P0)

```bash
cd backend
npm test -- --testPathPattern="eligibility|weekly-plan|dish-nutrition"
```
