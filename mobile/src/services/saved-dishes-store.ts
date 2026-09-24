import { queryClient } from '../lib/query-client';
import { dishesApi } from './api/dishes';
import type { SavedDishItem } from './api/types';
import { PROFILE_DASHBOARD_QUERY_KEY } from '../hooks/useProfileDashboard';
import type { ProfileDashboard } from './api/profile';
import { saveCachedProfileDashboard } from './api/storage';

// In-memory set of saved dish IDs for instant synchronous access
const savedDishIds = new Set<string>();
let hasSynced = false;
const listeners = new Set<(dishId: string, isSaved: boolean) => void>();

export function subscribeSavedDishChange(listener: (dishId: string, isSaved: boolean) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(dishId: string, isSaved: boolean) {
  listeners.forEach((fn) => {
    try {
      fn(dishId, isSaved);
    } catch {
      // ignore
    }
  });
}

/** Check if dishId is currently saved in local memory cache */
export function isDishSaved(dishId?: string | null): boolean {
  if (!dishId) return false;
  return savedDishIds.has(dishId);
}

/** Synchronize saved dish IDs from server */
export async function syncSavedDishesCache(): Promise<Set<string>> {
  try {
    const res = await dishesApi.getSaved(undefined, 100);
    const items = (res.data ?? (res as any).items ?? []) as SavedDishItem[];
    savedDishIds.clear();
    for (const item of items) {
      const id = item.dish?.id ?? item.dishId;
      if (id) savedDishIds.add(id);
    }
    hasSynced = true;
  } catch {
    // ignore
  }
  return savedDishIds;
}

/** Ensure cache is synced at least once */
export function ensureSavedDishesSynced() {
  if (!hasSynced) {
    void syncSavedDishesCache();
  }
}

/**
 * Toggle save dish with optimistic updates to:
 * 1. Local savedDishIds set
 * 2. TanStack Query cache for ['profile', 'savedDishes']
 * 3. TanStack Query cache for ['profile', 'dashboard'] (shortcuts.savedDishes)
 */
export async function toggleDishSave(
  dishId: string,
  currentlySaved?: boolean,
  dishMeta?: { name?: string; imageUrl?: string; priceMin?: number; priceMax?: number; kcal?: number },
): Promise<boolean> {
  if (!dishId) return false;

  const prev = currentlySaved !== undefined ? currentlySaved : savedDishIds.has(dishId);
  const next = !prev;

  // Optimistic update in memory
  if (next) savedDishIds.add(dishId);
  else savedDishIds.delete(dishId);
  notifyListeners(dishId, next);

  // Optimistic update in React Query dashboard cache
  queryClient.setQueryData<ProfileDashboard>(PROFILE_DASHBOARD_QUERY_KEY, (old) => {
    if (!old) return old;
    const currentCount = old.shortcuts?.savedDishes ?? 0;
    const newCount = next ? currentCount + 1 : Math.max(0, currentCount - 1);
    const updated: ProfileDashboard = {
      ...old,
      shortcuts: {
        ...old.shortcuts,
        savedDishes: newCount,
      },
    };
    void saveCachedProfileDashboard(updated);
    return updated;
  });

  // Optimistic update in React Query savedDishes list cache
  queryClient.setQueriesData<SavedDishItem[]>(
    { queryKey: ['profile', 'savedDishes'] },
    (old = []) => {
      if (next) {
        // Add item to list if not already present
        const exists = old.some((item) => (item.dish?.id ?? item.dishId) === dishId);
        if (exists) return old;
        const newItem: SavedDishItem = {
          id: `opt-${dishId}-${Date.now()}`,
          dishId,
          savedAt: new Date().toISOString(),
          dish: {
            id: dishId,
            name: dishMeta?.name ?? 'Món ăn',
            slug: '',
            shortDescription: null,
            status: 'APPROVED',
            priceMin: dishMeta?.priceMin ?? null,
            priceMax: dishMeta?.priceMax ?? null,
            prepMinutes: null,
            cookMinutes: null,
            nutrition: dishMeta?.kcal ? { calories: dishMeta.kcal } : null,
            media: [],
            kcal: dishMeta?.kcal ?? null,
            thumbnailUrl: dishMeta?.imageUrl,
          } as any,
        };
        return [newItem, ...old];
      } else {
        // Remove item from list
        return old.filter((item) => (item.dish?.id ?? item.dishId) !== dishId);
      }
    },
  );

  try {
    if (next) {
      await dishesApi.save(dishId);
    } else {
      await dishesApi.unsave(dishId);
    }

    // Invalidate queries so background refetch keeps data 100% in sync with server
    void queryClient.invalidateQueries({ queryKey: ['profile', 'savedDishes'] });
    void queryClient.invalidateQueries({ queryKey: PROFILE_DASHBOARD_QUERY_KEY });

    return next;
  } catch (err) {
    // Rollback on failure
    if (prev) savedDishIds.add(dishId);
    else savedDishIds.delete(dishId);
    notifyListeners(dishId, prev);

    void queryClient.invalidateQueries({ queryKey: ['profile', 'savedDishes'] });
    void queryClient.invalidateQueries({ queryKey: PROFILE_DASHBOARD_QUERY_KEY });
    throw err;
  }
}
