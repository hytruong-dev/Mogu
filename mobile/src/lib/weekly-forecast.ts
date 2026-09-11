/** actualCompleted + expectedPending (remaining projected slots). */
export function computeWeeklyForecast(plan: {
  actualSpentVnd?: number | null;
  projectedCostVnd?: number | null;
  actualKcal?: number | null;
  projectedKcal?: number | null;
}) {
  const actualCompleted = plan.actualSpentVnd ?? 0;
  const expectedPending = Math.max(0, (plan.projectedCostVnd ?? 0) - actualCompleted);
  const forecastSpent = actualCompleted + expectedPending;

  const actualKcalCompleted = plan.actualKcal ?? 0;
  const expectedKcalPending = Math.max(0, (plan.projectedKcal ?? 0) - actualKcalCompleted);
  const forecastKcal = actualKcalCompleted + expectedKcalPending;

  return { actualCompleted, expectedPending, forecastSpent, actualKcalCompleted, expectedKcalPending, forecastKcal };
}
