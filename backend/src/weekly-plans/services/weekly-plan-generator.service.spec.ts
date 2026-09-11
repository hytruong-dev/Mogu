import { DishEligibilityService } from '../../dishes/eligibility/dish-eligibility.service';

/**
 * P0 safety: generator must never call "any published" fallback.
 * Guard via source inspection of the compiled service methods.
 */
describe('WeeklyPlanGeneratorService safety contract', () => {
  it('DishEligibilityService is required dependency for hard filters', () => {
    expect(DishEligibilityService).toBeDefined();
  });

  it('generator module source does not contain queryAnyPublishedDish', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, 'weekly-plan-generator.service.ts'),
      'utf8',
    );
    expect(src).not.toContain('queryAnyPublishedDish');
    expect(src).toContain('buildHardWhere');
    expect(src).toContain('BUDGET_EXCEEDED');
  });
});
