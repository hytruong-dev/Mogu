import { queryClient } from '../lib/query-client';
import { PROFILE_DASHBOARD_QUERY_KEY } from '../hooks/useProfileDashboard';
import type { ProfileDashboard } from './api/profile';
import { saveCachedProfileDashboard } from './api/storage';
import type { ExplorePost } from './api/explore';
import type { RandomizationResult } from './api/randomization';

/**
 * ============================================================================
 * App Central Data Store & Query Cache Synchronization Manager
 *
 * Ensures that any mutation across any mobile screen (Random, Explore,
 * Health, Weekly Plan, Profile) immediately updates:
 * 1. TanStack Query cache for local component queries
 * 2. Profile Dashboard shortcuts & social counters
 * 3. AsyncStorage cached dashboard snapshot
 * 4. Background revalidation to keep client in sync with backend
 * ============================================================================
 */

/** Helper to update ProfileDashboard in TanStack Query and AsyncStorage */
export function updateProfileDashboardStore(
  updater: (prev: ProfileDashboard) => ProfileDashboard,
) {
  queryClient.setQueryData<ProfileDashboard>(PROFILE_DASHBOARD_QUERY_KEY, (old) => {
    if (!old) return old;
    const updated = updater(old);
    void saveCachedProfileDashboard(updated);
    return updated;
  });
}

/**
 * ----------------------------------------------------------------------------
 * 1. RANDOM FLOW MUTATIONS
 * ----------------------------------------------------------------------------
 */

/** Call when a new random spin completes successfully */
export function recordRandomRunStore(result?: RandomizationResult | null) {
  // 1. Increment shortcuts.randomRuns in Profile Dashboard
  updateProfileDashboardStore((dash) => ({
    ...dash,
    shortcuts: {
      ...dash.shortcuts,
      randomRuns: (dash.shortcuts?.randomRuns ?? 0) + 1,
    },
  }));

  // 2. Optimistically update randomHistory query cache if present
  queryClient.setQueriesData<{ summary: any; items: any[] }>(
    { queryKey: ['profile', 'randomHistory'] },
    (old) => {
      if (!old) return old;
      const newItems = result?.dish
        ? [
            {
              id: result.randomizationId || `run-${Date.now()}`,
              dishId: result.dish.id,
              dish: result.dish,
              outcome: 'SUGGESTED',
              createdAt: new Date().toISOString(),
              totalCalories: result.dish.nutrition?.calories ?? null,
            },
            ...(old.items || []),
          ]
        : old.items;

      return {
        ...old,
        summary: {
          ...old.summary,
          totalRuns: (old.summary?.totalRuns ?? 0) + 1,
        },
        items: newItems,
      };
    },
  );

  // 3. Invalidate to background sync
  void queryClient.invalidateQueries({ queryKey: ['profile', 'randomHistory'] });
  void queryClient.invalidateQueries({ queryKey: PROFILE_DASHBOARD_QUERY_KEY });
}

/** Call when user selects a random dish ("Chọn món này") */
export function recordRandomSelectionStore(result?: RandomizationResult | null) {
  // 1. Update Profile Dashboard (meals logged count)
  updateProfileDashboardStore((dash) => ({
    ...dash,
    shortcuts: {
      ...dash.shortcuts,
      mealLogsThisMonth: (dash.shortcuts?.mealLogsThisMonth ?? 0) + 1,
    },
    journeyPreview: {
      ...dash.journeyPreview,
      mealsLoggedThisMonth: (dash.journeyPreview?.mealsLoggedThisMonth ?? 0) + 1,
    },
  }));

  // 2. Update status in randomHistory query cache
  queryClient.setQueriesData<{ summary: any; items: any[] }>(
    { queryKey: ['profile', 'randomHistory'] },
    (old) => {
      if (!old) return old;
      const updatedItems = (old.items || []).map((item, idx) => {
        if (
          idx === 0 ||
          (result?.randomizationId && item.id === result.randomizationId) ||
          (result?.dish?.id && item.dishId === result.dish.id)
        ) {
          return { ...item, outcome: 'SELECTED' };
        }
        return item;
      });

      return {
        ...old,
        summary: {
          ...old.summary,
          selectedCount: (old.summary?.selectedCount ?? 0) + 1,
        },
        items: updatedItems,
      };
    },
  );

  // 3. Invalidate related queries so Diary and Health screens get fresh data
  void queryClient.invalidateQueries({ queryKey: ['profile', 'randomHistory'] });
  void queryClient.invalidateQueries({ queryKey: ['profile', 'diary'] });
  void queryClient.invalidateQueries({ queryKey: ['profile', 'journey'] });
  void queryClient.invalidateQueries({ queryKey: ['health', 'day'] });
  void queryClient.invalidateQueries({ queryKey: PROFILE_DASHBOARD_QUERY_KEY });
}

/**
 * ----------------------------------------------------------------------------
 * 2. COMMUNITY POSTS MUTATIONS
 * ----------------------------------------------------------------------------
 */

/** Call when a post is created / published */
export function recordPostCreatedStore(post: ExplorePost) {
  const isDraft = post.status === 'DRAFT';

  // 1. Update Profile Dashboard counts
  updateProfileDashboardStore((dash) => ({
    ...dash,
    shortcuts: {
      ...dash.shortcuts,
      myPublishedPosts: isDraft
        ? dash.shortcuts?.myPublishedPosts ?? 0
        : (dash.shortcuts?.myPublishedPosts ?? 0) + 1,
      myDraftPosts: isDraft
        ? (dash.shortcuts?.myDraftPosts ?? 0) + 1
        : dash.shortcuts?.myDraftPosts ?? 0,
    },
    socialStats: {
      ...dash.socialStats,
      publishedPostCount: isDraft
        ? dash.socialStats?.publishedPostCount ?? 0
        : (dash.socialStats?.publishedPostCount ?? 0) + 1,
    },
  }));

  // 2. Optimistically add to myPosts cache in TanStack Query
  queryClient.setQueriesData<{ pubItems: ExplorePost[]; draftItems: ExplorePost[] }>(
    { queryKey: ['profile', 'myPosts'] },
    (old) => {
      if (!old) return old;
      if (isDraft) {
        return {
          ...old,
          draftItems: [post, ...(old.draftItems || [])],
        };
      } else {
        return {
          ...old,
          pubItems: [post, ...(old.pubItems || [])],
        };
      }
    },
  );

  // 3. Invalidate queries
  void queryClient.invalidateQueries({ queryKey: ['profile', 'myPosts'] });
  void queryClient.invalidateQueries({ queryKey: PROFILE_DASHBOARD_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: ['explore', 'feed'] });
}

/** Call when a post is deleted */
export function recordPostDeletedStore(postId: string) {
  // 1. Update Profile Dashboard counts
  updateProfileDashboardStore((dash) => ({
    ...dash,
    shortcuts: {
      ...dash.shortcuts,
      myPublishedPosts: Math.max(0, (dash.shortcuts?.myPublishedPosts ?? 1) - 1),
    },
    socialStats: {
      ...dash.socialStats,
      publishedPostCount: Math.max(0, (dash.socialStats?.publishedPostCount ?? 1) - 1),
    },
  }));

  // 2. Optimistically remove from myPosts cache
  queryClient.setQueriesData<{ pubItems: ExplorePost[]; draftItems: ExplorePost[] }>(
    { queryKey: ['profile', 'myPosts'] },
    (old) => {
      if (!old) return old;
      return {
        ...old,
        pubItems: (old.pubItems || []).filter((p) => p.id !== postId),
        draftItems: (old.draftItems || []).filter((p) => p.id !== postId),
      };
    },
  );

  // 3. Invalidate queries
  void queryClient.invalidateQueries({ queryKey: ['profile', 'myPosts'] });
  void queryClient.invalidateQueries({ queryKey: PROFILE_DASHBOARD_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: ['explore', 'feed'] });
}

/** Call when a post is updated (e.g. visibility change or content edit) */
export function recordPostUpdatedStore(post: ExplorePost) {
  queryClient.setQueriesData<{ pubItems: ExplorePost[]; draftItems: ExplorePost[] }>(
    { queryKey: ['profile', 'myPosts'] },
    (old) => {
      if (!old) return old;
      return {
        ...old,
        pubItems: (old.pubItems || []).map((p) => (p.id === post.id ? post : p)),
        draftItems: (old.draftItems || []).map((p) => (p.id === post.id ? post : p)),
      };
    },
  );

  void queryClient.invalidateQueries({ queryKey: ['profile', 'myPosts'] });
  void queryClient.invalidateQueries({ queryKey: PROFILE_DASHBOARD_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: ['explore', 'feed'] });
}

/**
 * ----------------------------------------------------------------------------
 * 3. MEAL LOGS & DIARY MUTATIONS
 * ----------------------------------------------------------------------------
 */

/** Call when a meal is logged */
export function recordMealLoggedStore() {
  updateProfileDashboardStore((dash) => ({
    ...dash,
    shortcuts: {
      ...dash.shortcuts,
      mealLogsThisMonth: (dash.shortcuts?.mealLogsThisMonth ?? 0) + 1,
    },
    journeyPreview: {
      ...dash.journeyPreview,
      mealsLoggedThisMonth: (dash.journeyPreview?.mealsLoggedThisMonth ?? 0) + 1,
    },
  }));

  void queryClient.invalidateQueries({ queryKey: ['profile', 'diary'] });
  void queryClient.invalidateQueries({ queryKey: ['profile', 'journey'] });
  void queryClient.invalidateQueries({ queryKey: ['health', 'day'] });
  void queryClient.invalidateQueries({ queryKey: PROFILE_DASHBOARD_QUERY_KEY });
}

/** Call when a meal log is deleted */
export function recordMealDeletedStore() {
  updateProfileDashboardStore((dash) => ({
    ...dash,
    shortcuts: {
      ...dash.shortcuts,
      mealLogsThisMonth: Math.max(0, (dash.shortcuts?.mealLogsThisMonth ?? 1) - 1),
    },
    journeyPreview: {
      ...dash.journeyPreview,
      mealsLoggedThisMonth: Math.max(0, (dash.journeyPreview?.mealsLoggedThisMonth ?? 1) - 1),
    },
  }));

  void queryClient.invalidateQueries({ queryKey: ['profile', 'diary'] });
  void queryClient.invalidateQueries({ queryKey: ['profile', 'journey'] });
  void queryClient.invalidateQueries({ queryKey: ['health', 'day'] });
  void queryClient.invalidateQueries({ queryKey: PROFILE_DASHBOARD_QUERY_KEY });
}

/**
 * ----------------------------------------------------------------------------
 * 4. HEALTH MEASUREMENTS MUTATIONS
 * ----------------------------------------------------------------------------
 */

export function recordHealthMeasurementStore() {
  void queryClient.invalidateQueries({ queryKey: ['profile', 'healthProfile'] });
  void queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
  void queryClient.invalidateQueries({ queryKey: ['health', 'day'] });
  void queryClient.invalidateQueries({ queryKey: PROFILE_DASHBOARD_QUERY_KEY });
}

/**
 * ----------------------------------------------------------------------------
 * 5. PROFILE IDENTITY & PREFERENCES MUTATIONS
 * ----------------------------------------------------------------------------
 */

export function recordProfileUpdatedStore(patch: {
  displayName?: string | null;
  avatarUrl?: string | null;
  username?: string | null;
}) {
  updateProfileDashboardStore((dash) => ({
    ...dash,
    profile: {
      ...dash.profile,
      displayName: patch.displayName !== undefined ? patch.displayName : dash.profile.displayName,
      username: patch.username !== undefined ? patch.username : dash.profile.username,
      avatar: {
        ...dash.profile.avatar,
        url: patch.avatarUrl !== undefined ? patch.avatarUrl : dash.profile.avatar.url,
      },
    },
  }));

  void queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
  void queryClient.invalidateQueries({ queryKey: PROFILE_DASHBOARD_QUERY_KEY });
}

export function recordPreferencesUpdatedStore() {
  void queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
  void queryClient.invalidateQueries({ queryKey: PROFILE_DASHBOARD_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: ['home'] });
}

export function recordAvoidancesUpdatedStore() {
  void queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
  void queryClient.invalidateQueries({ queryKey: PROFILE_DASHBOARD_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: ['home'] });
}
