import { apiRequest } from './client';

export type HealthDayResponse = {
  localDate: string;
  timezone: string;
  dataStatus: 'OK' | 'PARTIAL' | 'no_data' | string;
  energy: {
    consumedKcal: number | null;
    targetKcal: number | null;
    remainingKcal: number | null;
    burnedKcal: number | null;
  };
  macros: {
    protein: { consumedG: number | null; targetG: number | null };
    carbs: { consumedG: number | null; targetG: number | null };
    fat: { consumedG: number | null; targetG: number | null };
  };
  water: { consumedMl: number | null; targetMl: number | null };
  steps: { count: number | null; target: number | null; source: string | null; syncedAt: string | null };
  mealGroups: Array<{
    mealSlot: string;
    totalKcal: number;
    meals: Array<{
      id: string;
      mealSlot: string;
      totals: { kcal: number; proteinG: number | null; carbsG: number | null; fatG: number | null };
      items: Array<{ id: string; displayName: string; calories: number | null }>;
    }>;
  }>;
};

export type MealLog = {
  id: string;
  mealSlot: string;
  localDate: string;
  totals: { kcal: number; proteinG: number | null; carbsG: number | null; fatG: number | null };
  items: Array<{ id: string; displayName: string; referenceId?: string | null; calories: number | null }>;
  version: number;
};

export const healthApi = {
  getDay: (localDate: string, timezone: string) =>
    apiRequest<HealthDayResponse>(
      `/health/days/${localDate}?timezone=${encodeURIComponent(timezone)}`,
    ),

  listMealLogs: (localDate: string, timezone: string) =>
    apiRequest<{ items: MealLog[] }>(
      `/meal-logs?localDate=${localDate}&timezone=${encodeURIComponent(timezone)}`,
    ),

  createMealLog: (body: {
    mealSlot: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
    timezone?: string;
    occurredAt?: string;
    source?: { type: string; randomizationId?: string; weeklyPlanSlotId?: string };
    items: Array<{
      referenceType: 'DISH' | 'INGREDIENT' | 'CUSTOM_FOOD';
      referenceId?: string;
      displayName?: string;
      quantity: number;
      unitCode?: string;
    }>;
  }) =>
    apiRequest<MealLog>('/meal-logs', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Idempotency-Key': `meal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
    }),

  addWater: (amountMl: number, localDate: string, timezone: string, idempotencyKey?: string) =>
    apiRequest('/water-logs', {
      method: 'POST',
      body: JSON.stringify({ amountMl, localDate, timezone }),
      headers: {
        'Idempotency-Key':
          idempotencyKey || `water-${localDate}-${amountMl}-${Date.now()}`,
      },
    }),

  deleteWater: (id: string) =>
    apiRequest(`/water-logs/${id}`, { method: 'DELETE' }),
};
