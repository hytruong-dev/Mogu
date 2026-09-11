# ADR: Random & Weekly Plan Constraints

**Status:** Accepted  
**Date:** 2026-09-11  
**Context:** [docs/PROJECT_REVIEW_RANDOM_MEAL_WEEKLY_BUDGET.md](../PROJECT_REVIEW_RANDOM_MEAL_WEEKLY_BUDGET.md) mục 15 (BR-01–BR-05)

## Quyết định

| ID | Quyết định |
|----|------------|
| BR-01 | Ngân sách = tổng cho toàn kỳ `durationDays` × slots đã chọn. UI: “Ngân sách cho N ngày”. Giá dự toán = `priceMin`. `null` giá → loại khỏi hard-budget plan (không coi = 0). |
| BR-02 | `mealsPerDay` derive từ `enabledSlots` unique. PROFILE kcal = `profile.goalKcal` (thiếu → default 2000, ghi nguồn DEFAULT). |
| BR-03 | Hard (không bao giờ nới): allergen `CONTAINS`; hard diet **AND**; avoided ingredients qua quan hệ ingredient (+ synonym/alias). Soft: meal type, budget preference (random), avoid-repeat, kcal tolerance. |
| BR-04 | Generate giữ ACTIVE hiện tại; theo dõi `planId` tới READY/FAILED. Regenerate: không archive cũ trước khi bản mới READY. Worker không revive ARCHIVED. |
| BR-05 | SELECT ≠ đã ăn. COMPLETE → MealLog + actuals (idempotent). SKIP không tạo consumption. |

### Allergen levels

| Level | Random | Weekly / Swap / Home |
|-------|--------|----------------------|
| `CONTAINS` | Hard reject | Hard reject |
| `MAY_CONTAIN` | Soft exclude (có thể nới) | Hard reject |

### MVP meal model

Một `WeeklyPlanSlot` = một dish = một bữa hoàn chỉnh.

## Acceptance matrix

| Constraint | Random | Weekly generate | Swap | Home recommend |
|------------|--------|-----------------|------|----------------|
| Allergen CONTAINS | Hard | Hard | Hard | Hard |
| Allergen MAY_CONTAIN | Soft | Hard | Hard | Hard |
| Hard diet (AND) | Hard | Hard | Hard | Hard |
| Soft diet preference | Soft | Soft | Soft | Soft |
| Avoided ingredients | Hard | Hard | Hard | Hard |
| Budget | Soft (preference) | Hard (projected ≤ limit) | Hard remaining | N/A |
| Meal slot | Soft | Soft (nới được) | Soft | Soft |
| Missing price | Allowed | Excluded | Excluded if hard-budget | Allowed |
| Missing nutrition | Allowed | Soft (không giả 0/500) | Keep null | Allowed |

## Consequences

- Shared `DishEligibilityService` cho mọi bề mặt “gợi ý phù hợp người dùng”.
- Fallback “any published dish” bị cấm.
- READY chỉ sau final validator budget + hard constraints.
