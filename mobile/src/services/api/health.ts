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
  items: Array<{ id: string; displayName: string; referenceId?: string | null; calories: number | null; thumbnailUrl?: string | null }>;
  version: number;
};

export type FormattedMealLogItem = {
  id: string;
  referenceType: string;
  referenceId?: string | null;
  displayName: string;
  quantity: number;
  unitCode?: string;
  calories?: number | null;
  thumbnailUrl?: string | null;
};

export type FormattedMealLog = {
  id: string;
  mealSlot: string;
  occurredAt: string;
  localDate: string;
  sourceType: string;
  totals: { kcal: number; proteinG: number | null; carbsG: number | null; fatG: number | null };
  items: FormattedMealLogItem[];
};

export type DayGroupItem = {
  localDate: string;
  label: string;
  consumedKcal: number;
  mealCount: number;
  previewMediaUrls: string[];
  meals: FormattedMealLog[];
};

export type MonthGroupItem = {
  monthKey: string;
  monthNumber: number;
  label: string;
  shortLabel: string;
  consumedKcal: number;
  mealCount: number;
  hasData: boolean;
  previewMediaUrls: string[];
};

export type SeriesItem = {
  key: string;
  label: string;
  subLabel?: string;
  date?: string;
  consumedKcal: number | null;
  kcal: number;
  mealCount: number;
};

export type WeeklySeriesItem = {
  key: string;
  label: string;
  subLabel: string;
  consumedKcal: number | null;
  mealCount: number;
};

export type MealStatsResponse = {
  period: 'day' | 'week' | 'month' | 'year';
  date: string;
  startDate: string;
  endDate: string;
  label: string;
  totals: {
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
  targets: {
    dailyKcalTarget: number | null;
    periodKcalTarget: number | null;
    dailyProteinG: number | null;
    periodProteinG: number | null;
    dailyCarbsG: number | null;
    periodCarbsG: number | null;
    dailyFatG: number | null;
    periodFatG: number | null;
  };
  avgKcalPerDay: number;
  avgKcalPerActiveDay: number;
  daysLogged: number;
  totalDays: number;
  coveragePercent: number;
  totalMeals: number;
  series: SeriesItem[];
  breakdown: SeriesItem[];
  weeklySeries: WeeklySeriesItem[];
  dayGroups: DayGroupItem[];
  monthGroups: MonthGroupItem[];
  insights: {
    highestDay: { date: string; label: string; kcal: number; mealCount: number } | null;
    highestMonth: { monthKey: string; label: string; kcal: number; mealCount: number } | null;
    summary: string;
  };
  items: FormattedMealLog[];
};

export const healthApi = {
  getDay: (localDate: string, timezone: string) =>
    apiRequest<HealthDayResponse>(
      `/health/days/${localDate}?timezone=${encodeURIComponent(timezone)}`,
    ),

  getCalendar: (month?: string, timezone?: string) => {
    const query = new URLSearchParams();
    if (month) query.set('month', month);
    if (timezone) query.set('timezone', timezone);
    const qs = query.toString();
    return apiRequest<{ month: string; days: Array<any> }>(`/health/calendar${qs ? `?${qs}` : ''}`);
  },

  listMealLogs: (localDate: string, timezone: string) =>
    apiRequest<{ items: MealLog[] }>(
      `/meal-logs?localDate=${localDate}&timezone=${encodeURIComponent(timezone)}`,
    ),

  getMealStats: (
    period: 'day' | 'week' | 'month' | 'year',
    date?: string,
    timezone?: string,
  ) => {
    const query = new URLSearchParams();
    query.set('period', period);
    if (date) {
      query.set('anchor', date);
      query.set('date', date);
    }
    if (timezone) query.set('timezone', timezone);
    return apiRequest<MealStatsResponse>(`/meal-logs/stats?${query.toString()}`);
  },

  createMealLog: (
    body: {
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
    },
    idempotencyKey?: string,
  ) =>
    apiRequest<MealLog>('/meal-logs', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Idempotency-Key':
          idempotencyKey || `meal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
    }),

  updateMealLog: (id: string, body: any, version: number = 1) =>
    apiRequest<MealLog>(`/meal-logs/${id}`, {
      method: 'PATCH',
      headers: { 'If-Match': `"${version}"` },
      body: JSON.stringify(body),
    }),

  deleteMealLog: (id: string, version: number = 1) =>
    apiRequest<{ deleted: boolean }>(`/meal-logs/${id}`, {
      method: 'DELETE',
      headers: { 'If-Match': `"${version}"` },
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

  deleteWater: (id: string, version: number = 1) =>
    apiRequest(`/water-logs/${id}`, {
      method: 'DELETE',
      headers: { 'If-Match': `"${version}"` },
    }),

  // Custom foods
  getCustomFoods: () => apiRequest<{ items: Array<any> }>('/me/custom-foods'),

  createCustomFood: (dto: { name: string; calories: number }, idempotencyKey?: string) =>
    apiRequest('/me/custom-foods', {
      method: 'POST',
      headers: {
        'Idempotency-Key': idempotencyKey || `cfood-${Date.now()}`,
      },
      body: JSON.stringify(dto),
    }),

  updateCustomFood: (id: string, dto: any, version: number = 1) =>
    apiRequest(`/me/custom-foods/${id}`, {
      method: 'PATCH',
      headers: { 'If-Match': `"${version}"` },
      body: JSON.stringify(dto),
    }),

  deleteCustomFood: (id: string, version: number = 1) =>
    apiRequest(`/me/custom-foods/${id}`, {
      method: 'DELETE',
      headers: { 'If-Match': `"${version}"` },
    }),

  // Measurements & Health Targets
  createMeasurement: (dto: { type: 'HEIGHT_CM' | 'WEIGHT_KG'; value: number; unit?: string }) =>
    apiRequest('/me/measurements', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  listMeasurements: (type?: string, limit?: number) => {
    const query = new URLSearchParams();
    if (type) query.set('type', type);
    if (limit) query.set('limit', String(limit));
    const qs = query.toString();
    return apiRequest<{ items: Array<any> }>(`/me/measurements${qs ? `?${qs}` : ''}`);
  },

  deleteMeasurement: (id: string) =>
    apiRequest<{ deleted: boolean }>(`/me/measurements/${id}`, { method: 'DELETE' }),

  getHealthTarget: () => apiRequest<any>('/me/health-targets'),

  updateHealthTarget: (dto: any, version: number = 1) =>
    apiRequest('/me/health-targets', {
      method: 'PUT',
      headers: { 'If-Match': `"${version}"` },
      body: JSON.stringify(dto),
    }),

  syncActivity: (dto: {
    provider: string;
    buckets: Array<{
      type: string;
      startAt: string;
      endAt: string;
      value: number;
      dedupeKey?: string;
    }>;
  }) =>
    apiRequest('/activity-sync', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
};
