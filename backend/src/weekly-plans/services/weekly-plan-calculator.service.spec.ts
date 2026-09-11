import { WeeklyMealSlot } from '@prisma/client';
import { WeeklyPlanCalculatorService } from './weekly-plan-calculator.service';

describe('WeeklyPlanCalculatorService', () => {
  const calc = new WeeklyPlanCalculatorService();

  it('allocates daily budget across enabled slots from period budget', () => {
    const alloc = calc.allocateDay({
      budgetVnd: 700000,
      kcalPerDay: 2000,
      durationDays: 7,
      enabledSlots: [WeeklyMealSlot.MORNING, WeeklyMealSlot.LUNCH, WeeklyMealSlot.DINNER],
    });
    const dayBudget =
      alloc.MORNING.budgetVnd + alloc.LUNCH.budgetVnd + alloc.DINNER.budgetVnd;
    expect(dayBudget).toBeLessThanOrEqual(Math.floor(700000 / 7));
    expect(alloc.LUNCH.budgetVnd).toBeGreaterThan(alloc.MORNING.budgetVnd);
  });

  it('fitsSlot respects kcal tolerance percent', () => {
    expect(calc.fitsSlot(20000, 500, 30000, 500, 10)).toBe(true);
    expect(calc.fitsSlot(20000, 700, 30000, 500, 10)).toBe(false);
  });
});
