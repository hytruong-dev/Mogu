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

export async function upsertWeeklyPlanConfig(dto: UpsertWeeklyPlanConfigDto): Promise<WeeklyPlanConfig> {
  return apiRequest<WeeklyPlanConfig>('/weekly-plan-config', {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

// ── Plans ─────────────────────────────────────────────────────────────────────

export async function generateWeeklyPlan(startDate: string): Promise<WeeklyPlanGenerateResponse> {
  return apiRequest<WeeklyPlanGenerateResponse>('/weekly-plans/generate', {
    method: 'POST',
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
    headers: { 'If-Match': String(version) },
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
};

export async function swapSlot(
  planId: string,
  slotId: string,
  dto: WeeklyPlanSlotSwapDto,
): Promise<SwapSlotResult> {
  return apiRequest<SwapSlotResult>(`/weekly-plans/${planId}/slots/${slotId}/swap`, {
    method: 'POST',
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
    body: JSON.stringify({ isLocked, version }),
  });
}

export async function completeSlot(
  planId: string,
  slotId: string,
  opts: { actualCostVnd?: number; actualKcal?: number; version: number },
): Promise<any> {
  return apiRequest<any>(`/weekly-plans/${planId}/slots/${slotId}/complete`, {
    method: 'POST',
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
    headers: { 'If-Match': String(version) },
  });
}
