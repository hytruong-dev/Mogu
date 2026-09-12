/**
 * BA-005 Weekly Meal Plan — Mobile API Client
 */
import { apiRequest } from './client';
import type {
  WeeklyPlanConfig,
  WeeklyPlan,
  WeeklyPlanSummary,
  WeeklyPlanGenerateResponse,
  WeeklyPlanListResponse,
  WeeklyPlanSlotSwapDto,
  UpsertWeeklyPlanConfigDto,
} from './types';

// ── Config ─────────────────────────────────────────────────────────────────────

export async function getWeeklyPlanConfig(): Promise<WeeklyPlanConfig> {
  return apiRequest<WeeklyPlanConfig>('/weekly-plan-config');
}

export async function upsertWeeklyPlanConfig(
  dto: UpsertWeeklyPlanConfigDto,
  version: number = 1,
): Promise<WeeklyPlanConfig> {
  return apiRequest<WeeklyPlanConfig>('/weekly-plan-config', {
    method: 'PUT',
    headers: {
      'If-Match': `"${version}"`,
      'x-profile-version': String(version),
    },
    body: JSON.stringify(dto),
  });
}

// ── Plans ─────────────────────────────────────────────────────────────────────

export async function generateWeeklyPlan(
  startDate: string,
  idempotencyKey?: string,
): Promise<WeeklyPlanGenerateResponse> {
  const key = idempotencyKey ?? `gen-plan-${startDate}-${Date.now()}`;
  return apiRequest<WeeklyPlanGenerateResponse>('/weekly-plans/generate', {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify({ startDate }),
  });
}

export async function getCurrentWeeklyPlan(): Promise<WeeklyPlan | null> {
  try {
    return await apiRequest<WeeklyPlan>('/weekly-plans/current');
  } catch (err: any) {
    if (err?.status === 404) return null;
    throw err;
  }
}

export async function getWeeklyPlanById(planId: string): Promise<WeeklyPlan> {
  return apiRequest<WeeklyPlan>(`/weekly-plans/${planId}`);
}

export async function getWeeklyPlanGenerationStatus(planId: string): Promise<{
  planId: string;
  status: string;
  progress: { totalSlots: number; completedSlots: number; percent: number };
  error?: string | null;
}> {
  return apiRequest(`/weekly-plans/${planId}/generation`);
}

export async function listWeeklyPlans(cursor?: string, limit?: number): Promise<WeeklyPlanListResponse> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  if (limit) params.set('limit', String(limit));
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiRequest<WeeklyPlanListResponse>(`/weekly-plans${qs}`);
}

export async function startWeeklyPlan(planId: string, version: number): Promise<WeeklyPlan> {
  return apiRequest<WeeklyPlan>(`/weekly-plans/${planId}/start`, {
    method: 'POST',
    headers: { 'If-Match': `"${version}"` },
  });
}

export async function regenerateWeeklyPlan(planId: string): Promise<WeeklyPlanGenerateResponse> {
  return apiRequest<WeeklyPlanGenerateResponse>(`/weekly-plans/${planId}/regenerate`, {
    method: 'POST',
  });
}

export async function archiveWeeklyPlan(planId: string): Promise<WeeklyPlan> {
  return apiRequest<WeeklyPlan>(`/weekly-plans/${planId}/archive`, {
    method: 'POST',
  });
}

// ── Slots ─────────────────────────────────────────────────────────────────────

export type SwapSlotSummary = {
  projectedCostVnd: number;
  projectedKcal: number;
  budgetLimitVnd: number;
  remainingBudgetVnd: number;
};

export type SwapSlotResult = {
  id: string;
  dishId: string;
  dishNameSnapshot: string;
  imageUrlSnapshot: string | null;
  priceSnapshotVnd: number;
  kcalSnapshot: number;
  proteinGSnapshot: number | null;
  carbsGSnapshot: number | null;
  fatGSnapshot: number | null;
  version: number;
  swapCount: number;
  budgetWarning: boolean;
  summary?: SwapSlotSummary;
};

export type SlotActionResult = {
  id: string;
  status: string;
  version: number;
  isLocked?: boolean;
};

const PLAN_TERMINAL: Set<string> = new Set(['READY', 'FAILED', 'CANCELLED']);

export async function pollWeeklyPlan(
  planId: string,
  opts?: { intervalMs?: number; maxAttempts?: number; onTick?: (plan: WeeklyPlan) => void },
): Promise<WeeklyPlan> {
  const intervalMs = opts?.intervalMs ?? 2000;
  const maxAttempts = opts?.maxAttempts ?? 45;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const plan = await getWeeklyPlanById(planId);
    opts?.onTick?.(plan);
    if (PLAN_TERMINAL.has(plan.status)) return plan;
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return getWeeklyPlanById(planId);
}

export async function swapSlot(
  planId: string,
  slotId: string,
  dto: WeeklyPlanSlotSwapDto,
  version: number = 1,
  idempotencyKey?: string,
): Promise<SwapSlotResult> {
  const key = idempotencyKey ?? `swap-${slotId}-${Date.now()}`;
  return apiRequest<SwapSlotResult>(`/weekly-plans/${planId}/slots/${slotId}/swap`, {
    method: 'POST',
    headers: {
      'If-Match': `"${version}"`,
      'Idempotency-Key': key,
    },
    body: JSON.stringify(dto),
  });
}

export async function lockSlot(
  planId: string,
  slotId: string,
  isLocked: boolean,
  version: number,
): Promise<any> {
  return apiRequest<any>(`/weekly-plans/${planId}/slots/${slotId}/lock`, {
    method: 'PATCH',
    headers: { 'If-Match': `"${version}"` },
    body: JSON.stringify({ isLocked, version }),
  });
}

export async function completeSlot(
  planId: string,
  slotId: string,
  opts: { actualCostVnd?: number; actualKcal?: number; version: number },
  idempotencyKey?: string,
): Promise<any> {
  const key = idempotencyKey ?? `comp-${slotId}-${Date.now()}`;
  return apiRequest<any>(`/weekly-plans/${planId}/slots/${slotId}/complete`, {
    method: 'POST',
    headers: {
      'If-Match': `"${opts.version}"`,
      'Idempotency-Key': key,
    },
    body: JSON.stringify(opts),
  });
}

export async function skipSlot(
  planId: string,
  slotId: string,
  version: number,
): Promise<any> {
  return apiRequest<any>(`/weekly-plans/${planId}/slots/${slotId}/skip`, {
    method: 'POST',
    headers: { 'If-Match': `"${version}"` },
  });
}
