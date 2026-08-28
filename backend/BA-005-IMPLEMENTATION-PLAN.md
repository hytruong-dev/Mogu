# BA-005: Weekly Meal Plan — Implementation Plan

> Phiên bản: 1.0 | Ngày: 2026-08-24
> Dựa trên: BA-005-WEEKLY-MEAL-PLAN.md v1.0

---

## Phan 0: Chot cac quyet dinh (muc 18 BA-005)

| # | Quyet dinh | Ket luan | Ly do |
|---|---|---|---|
| 1 | avoidRepeat la gi? | **Soft preference** — tra diem penalty cho mon da dung, khong loai cung | Tranh plan FAILED khi DB co it mon |
| 2 | Vuot kcal de bao dam ngan sach? | **Khong** — kcal tolerance luan duoc no rang, budget la hard limit | User dat budget la rang buoc chinh |
| 3 | Co vuot ngan sach khong? | **Khong bao gio** | BA noi ro "projected <= budget truoc khi READY" |
| 4 | User co plan active, generate plan moi? | **Cho phep tao READY, khong tu thay ACTIVE** | Giu hien trang plan dang chay |
| 5 | Gia dung cho MVP? | **priceMin cua Dish** (gia tu nau/gia thap nhat) | Phu hop muc tieu "tiet kiem" |
| 6 | PROFILE kcal? | **Lay goalKcal tu Profile**, neu null dung 2000 | Dong bo onboarding |
| 7 | Complete bua co bat buoc nhap actual cost? | **Khong bat buoc** — mac dinh = priceSnapshotVnd | Giam ma sat UX |
| 8 | Start date? | **User chon**, khong ep thu Hai | Linh hoat hon |

---

## Phan 1: Database (Phase A theo BA)

### 1.1 Them enums vao schema.prisma

```prisma
enum WeeklyPlanStatus {
  GENERATING
  READY
  ACTIVE
  COMPLETED
  FAILED
  CANCELLED
  ARCHIVED
}

enum WeeklyPlanSlotStatus {
  PLANNED
  COMPLETED
  SKIPPED
}

enum WeeklyMealSlot {
  MORNING
  LUNCH
  DINNER
  SNACK
}

enum WeeklyKcalMode {
  PROFILE
  CUSTOM
}

enum WeeklyPlanSwapReason {
  USER_REQUEST
  REBALANCE_BUDGET
  REBALANCE_CALORIES
  DISH_UNAVAILABLE
  DIET_CONFLICT
  OTHER
}
```

### 1.2 Them 4 models

1. **WeeklyPlanConfig** — cau hinh cua user (1 user = 1 config, upsert)
2. **WeeklyPlan** — thuc don tuan cu the voi snapshots
3. **WeeklyPlanSlot** — 1 bua trong 1 ngay
4. **WeeklyPlanSlotSwap** — lich su doi mon

**Luu y mapping voi schema hien tai:**
- `userId` tren `WeeklyPlanConfig` map voi `Profile.userId` (String uuid, khong phai Profile.id)
- `WeeklyPlanSlot.dishId` FK toi `Dish.id`
- `enabledSlots WeeklyMealSlot[]` luu nhu PostgreSQL array

### 1.3 Migration SQL thu cong

Can them sau khi prisma migrate:
```sql
-- Check constraints
ALTER TABLE weekly_plan_configs
  ADD CONSTRAINT check_budget_positive CHECK (budget_vnd > 0),
  ADD CONSTRAINT check_kcal_range CHECK (kcal_per_day BETWEEN 800 AND 5000),
  ADD CONSTRAINT check_duration CHECK (duration_days IN (3, 5, 7, 14)),
  ADD CONSTRAINT check_meals CHECK (meals_per_day BETWEEN 1 AND 4),
  ADD CONSTRAINT check_tolerance CHECK (calorie_tolerance_percent BETWEEN 0 AND 30);

ALTER TABLE weekly_plans
  ADD CONSTRAINT check_budget_nonneg CHECK (
    budget_limit_vnd > 0 AND projected_cost_vnd >= 0 AND actual_spent_vnd >= 0
  ),
  ADD CONSTRAINT check_kcal_nonneg CHECK (
    target_kcal > 0 AND projected_kcal >= 0 AND actual_kcal >= 0
  ),
  ADD CONSTRAINT check_date_order CHECK (end_date >= start_date);

ALTER TABLE weekly_plan_slots
  ADD CONSTRAINT check_slot_values_nonneg CHECK (
    price_snapshot_vnd >= 0 AND kcal_snapshot >= 0
  );

-- Partial unique indexes (chi 1 plan ACTIVE va 1 plan GENERATING tren moi user)
CREATE UNIQUE INDEX weekly_plans_one_active_idx
  ON weekly_plans (user_id) WHERE status = 'ACTIVE';

CREATE UNIQUE INDEX weekly_plans_one_generating_idx
  ON weekly_plans (user_id) WHERE status = 'GENERATING';

-- RLS
ALTER TABLE weekly_plan_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_plan_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_plan_slot_swaps ENABLE ROW LEVEL SECURITY;
```

---

## Phan 2: NestJS Module Structure

```
src/weekly-plans/
├── weekly-plans.module.ts
├── weekly-plan-config.controller.ts   (GET/PUT /v1/weekly-plan-config)
├── weekly-plans.controller.ts          (POST generate, GET current/detail/list, start/regenerate/archive)
├── weekly-plan-slots.controller.ts     (swap, lock, complete, skip)
├── services/
│   ├── weekly-plan-config.service.ts   -- upsert config, get config
│   ├── weekly-plans.service.ts         -- CRUD plan, state transitions
│   ├── weekly-plan-generator.service.ts -- build snapshot, candidate query, scoring
│   ├── weekly-plan-swap.service.ts     -- swap algorithm + transaction
│   ├── weekly-plan-calculator.service.ts -- tinh toan budget/kcal allocation
│   └── weekly-plan-validation.service.ts -- validate feasibility, state, ownership
├── processors/
│   └── weekly-plan.processor.ts        -- BullMQ worker: generate job
├── dto/
│   ├── upsert-weekly-plan-config.dto.ts
│   ├── generate-weekly-plan.dto.ts
│   ├── swap-weekly-plan-slot.dto.ts
│   ├── lock-weekly-plan-slot.dto.ts
│   ├── complete-weekly-plan-slot.dto.ts
│   └── weekly-plan-query.dto.ts
├── constants/
│   ├── weekly-plan-errors.ts            -- error codes theo BA
│   └── weekly-plan-weights.ts           -- MORNING 25%, LUNCH 40%, DINNER 35%, SNACK 5-10%
└── types/
    └── weekly-plan-snapshot.types.ts    -- ConfigSnapshot, ProfileSnapshot interfaces
```

---

## Phan 3: API Endpoints (11 endpoints)

### 3.1 Config

| Method | Path | Controller method | Notes |
|---|---|---|---|
| `GET` | `/v1/weekly-plan-config` | `getConfig` | Tra config hoac 404 |
| `PUT` | `/v1/weekly-plan-config` | `upsertConfig` | Upsert + validate |

### 3.2 Plan

| Method | Path | Controller method | Notes |
|---|---|---|---|
| `POST` | `/v1/weekly-plans/generate` | `generate` | 202, enqueue BullMQ |
| `GET` | `/v1/weekly-plans/current` | `getCurrent` | ACTIVE truoc, sau do READY moi nhat |
| `GET` | `/v1/weekly-plans` | `list` | Lich su (cursor pagination) |
| `GET` | `/v1/weekly-plans/:planId` | `getDetail` | Full plan voi days/slots |
| `POST` | `/v1/weekly-plans/:planId/start` | `start` | READY -> ACTIVE |
| `POST` | `/v1/weekly-plans/:planId/regenerate` | `regenerate` | Archive cu, generate moi |
| `POST` | `/v1/weekly-plans/:planId/archive` | `archive` | Manual archive |

### 3.3 Slots

| Method | Path | Controller method | Notes |
|---|---|---|---|
| `POST` | `/v1/weekly-plans/:planId/slots/:slotId/swap` | `swap` | Doi mon, transaction |
| `PATCH` | `/v1/weekly-plans/:planId/slots/:slotId/lock` | `lock` | Khoa/mo khoa |
| `POST` | `/v1/weekly-plans/:planId/slots/:slotId/complete` | `complete` | Xac nhan da an |
| `POST` | `/v1/weekly-plans/:planId/slots/:slotId/skip` | `skip` | Bo qua bua |

---

## Phan 4: Generate Algorithm (WeeklyPlanGeneratorService)

### Buoc 1: Build Profile Snapshot
```typescript
{
  userId, goalKcal, weightKg, heightCm,
  allergenIds: string[],           // tu UserAllergen
  avoidedIngredientNames: string[], // tu UserAvoidedIngredient
  dietTypeIds: string[],           // tu UserDietaryPreference (strength >= 1)
  goalCodes: string[],             // tu UserGoal
}
```

### Buoc 2: Tinh Slot Budget & Kcal Allocation
```
MORNING: 25% budget, 25% kcal
LUNCH:   40% budget, 40% kcal
DINNER:  35% budget, 35% kcal
SNACK:   tach tu cac slot tren theo so bua/ngay

Phan bo per-day: totalBudget / durationDays
Phan bo per-slot: perDayBudget * slotWeight
```

### Buoc 3: Hard Filters (WHERE clause Prisma)
```typescript
where: {
  status: 'PUBLISHED',
  deletedAt: null,
  // Allergen hard filter
  dishAllergens: { none: { allergen: { id: { in: allergenIds } }, level: 'CONTAINS' } },
  // Gia khong null va trong budget
  priceMin: { not: null, lte: slotBudgetMax },
  // Kcal khong null
  nutrition: { isNot: null },
  // MealType mapping
  mealTypes: { some: { mealTypeTag: { code: { in: mealTypeCodesForSlot } } } },
}
```

**Mapping WeeklyMealSlot -> MealTypeTag.code:**
```typescript
const SLOT_TO_MEAL_TYPE: Record<WeeklyMealSlot, string[]> = {
  MORNING: ['BREAKFAST', 'BUA_SANG'],
  LUNCH:   ['LUNCH', 'BUA_TRUA'],
  DINNER:  ['DINNER', 'BUA_TOI'],
  SNACK:   ['SNACK', 'BUA_PHU'],
};
```

### Buoc 4: Scoring (toi da 100 diem)
```typescript
score = 0;
// Goal match (25pts): cong diem voi tung goal user match
score += Math.min(25, goalMatchCount * 8);
// Kcal fit (25pts): giam dan theo |kcal - targetKcal| / targetKcal
score += 25 * Math.max(0, 1 - Math.abs(kcal - targetKcal) / targetKcal);
// Budget fit (20pts): giam dan theo |price - targetCost| / targetCost
score += 20 * Math.max(0, 1 - Math.abs(price - targetCost) / targetCost);
// Meal type match (10pts): chinh xac slot
score += dishHasMealType ? 10 : 0;
// Rating (10pts): ratingAvg * 2
score += Math.min(10, (dish.ratingAvg ?? 0) * 2);
// Novelty (10pts): giam neu da dung trong tuan nay
score += usedInThisWeek ? (avoidRepeat ? -15 : -5) : 10; // soft penalty
```

### Buoc 5: Selection Strategy
```
Sap xep slot theo do kho: it candidate nhat truoc
Voi moi slot:
  remainingBudget = budgetLimit - sumCostSelected
  remainingSlots  = totalSlots - slotsSelected
  targetBudget    = remainingBudget / remainingSlots (co trong so)
  Chon candidate gan target nhat (weighted random trong top 5)
Neu cuoi plan van khong hop le -> backtrack 3 slot cuoi, thu lai
Neu van fail -> FAILED + reason code
```

### Buoc 6: Luu trong transaction
```typescript
prisma.$transaction([
  prisma.weeklyPlan.update({ status: READY, projectedCostVnd, projectedKcal, ... }),
  prisma.weeklyPlanSlot.createMany({ data: allSlots }),
])
```

---

## Phan 5: BullMQ Queue

### Job
```typescript
Queue:  'weekly-plan-generation'
Job:    'generate-weekly-plan'
Job ID: `weekly-plan:${planId}`  // idempotent
Payload: { planId: string, userId: string }
```

### Processor
```typescript
@Processor('weekly-plan-generation')
class WeeklyPlanProcessor {
  @Process('generate-weekly-plan')
  async handle(job: Job<{ planId: string }>) {
    // 1. Load plan + config + profile
    // 2. Run generator
    // 3. Save slots in transaction
    // 4. Update plan status -> READY
    // On error: update status -> FAILED + errorCode
  }
}
```

---

## Phan 6: Key DTOs

### UpsertWeeklyPlanConfigDto
```typescript
{
  budgetVnd: number;          // @IsInt @Min(1)
  kcalPerDay: number;         // @IsInt @Min(800) @Max(5000)
  kcalMode: WeeklyKcalMode;   // @IsEnum
  durationDays: 3|5|7|14;    // @IsIn([3,5,7,14])
  mealsPerDay: 1|2|3|4;      // @IsInt @Min(1) @Max(4)
  enabledSlots: WeeklyMealSlot[]; // @ArrayMinSize(1) @IsEnum each, length = mealsPerDay
  avoidRepeat: boolean;
  preferHomeCook: boolean;
  calorieTolerancePercent: number; // @Min(0) @Max(30)
}
```

### GenerateWeeklyPlanDto
```typescript
{
  startDate: string; // @IsDateString 'YYYY-MM-DD'
}
// Header: Idempotency-Key (optional)
```

### SwapWeeklyPlanSlotDto
```typescript
{
  excludeDishIds?: string[];
  keepBudget?: boolean;
  keepCalories?: boolean;
  expectedVersion: number; // optimistic lock
}
```

### CompleteWeeklyPlanSlotDto
```typescript
{
  actualCostVnd?: number;  // optional, default = priceSnapshotVnd
  actualKcal?: number;     // optional, default = kcalSnapshot
  expectedVersion: number;
}
```

---

## Phan 7: Error Codes (constants/weekly-plan-errors.ts)

```typescript
export const WEEKLY_PLAN_ERRORS = {
  INVALID_CONFIG:         { status: 400, code: 'INVALID_CONFIG' },
  PLAN_NOT_FOUND:         { status: 404, code: 'PLAN_NOT_FOUND' },
  SLOT_NOT_FOUND:         { status: 404, code: 'SLOT_NOT_FOUND' },
  PLAN_ALREADY_GENERATING:{ status: 409, code: 'PLAN_ALREADY_GENERATING' },
  ACTIVE_PLAN_EXISTS:     { status: 409, code: 'ACTIVE_PLAN_EXISTS' },
  INVALID_PLAN_STATE:     { status: 409, code: 'INVALID_PLAN_STATE' },
  SLOT_LOCKED:            { status: 409, code: 'SLOT_LOCKED' },
  SLOT_ALREADY_COMPLETED: { status: 409, code: 'SLOT_ALREADY_COMPLETED' },
  VERSION_CONFLICT:       { status: 409, code: 'VERSION_CONFLICT' },
  NO_FEASIBLE_PLAN:       { status: 422, code: 'NO_FEASIBLE_PLAN' },
  NO_SWAP_CANDIDATE:      { status: 422, code: 'NO_SWAP_CANDIDATE' },
  MISSING_PRICE_DATA:     { status: 422, code: 'MISSING_PRICE_DATA' },
  MISSING_NUTRITION_DATA: { status: 422, code: 'MISSING_NUTRITION_DATA' },
} as const;
```

---

## Phan 8: Response format - GET /v1/weekly-plans/:planId

```typescript
{
  id, status, startDate, endDate,
  summary: {
    durationDays, totalMeals, mealsPerDay,
    budgetLimitVnd, projectedCostVnd,
    remainingBudgetVnd,          // budgetLimit - projectedCost
    actualSpentVnd,
    targetKcal, projectedKcal, actualKcal,
    calorieCompletionPercent     // projectedKcal / targetKcal * 100
  },
  days: [
    {
      date,                      // 'YYYY-MM-DD'
      projectedCostVnd,
      projectedKcal,
      slots: [
        {
          id, mealSlot, status, isLocked, swapCount,
          dish: {
            id, name, imageUrl,
            priceVnd,            // = priceSnapshotVnd (snapshot)
            kcal,                // = kcalSnapshot
            proteinG, carbsG, fatG
          },
          actualCostVnd, actualKcal
        }
      ]
    }
  ]
}
```

---

## Phan 9: Mobile integration (sau khi BE xong)

### Thay mock data bang API calls:

| Screen | API dung |
|---|---|
| HomeScreen WeeklyPlanCard | `GET /v1/weekly-plans/current` (lay summary) |
| WeeklyPlanScreen | `GET /v1/weekly-plans/current` (full days/slots) |
| EditPlanScreen | `GET /v1/weekly-plan-config` + `PUT /v1/weekly-plan-config` |
| Nut "Doi mon" | `POST /v1/weekly-plans/:id/slots/:slotId/swap` |
| Nut "Bat dau ke hoach" | `POST /v1/weekly-plans/:id/start` |
| Nut "Tao lai thuc don" | `POST /v1/weekly-plans/:id/regenerate` |

### New mobile service file:
```
mobile/src/services/api/weekly-plan.ts
```

---

## Tien do trien khai (theo Phase A-E cua BA)

| Phase | Noi dung | Files can tao/sua | Uoc tinh |
|---|---|---|---|
| **A** | DB Schema + Migration | `schema.prisma`, `scripts/migrate-005-weekly-plans.ts` | 1-2h |
| **B** | Config + Read API | `config.controller`, `config.service`, `plans.service`, `plans.controller` (GET) | 2-3h |
| **C** | Generate (BullMQ Worker) | `generator.service`, `calculator.service`, `processor`, `validation.service` | 3-4h |
| **D** | Interaction (swap/lock/complete) | `swap.service`, `slots.controller` | 2-3h |
| **E** | Mobile integration | `mobile/src/services/api/weekly-plan.ts`, update 3 screens | 2h |

**Tong: ~10-14h**

---

## Cac dieu kien truoc khi bat dau

- [ ] DB co du `Dish.priceMin` khong null cho it nhat 20 mon PUBLISHED
- [ ] `DishNutrition.calories` co du cho cac mon tren
- [ ] `MealTypeTag` co code phu hop: BREAKFAST/LUNCH/DINNER/SNACK
- [ ] BullMQ va Redis dang chay (da co tu BA-004)
