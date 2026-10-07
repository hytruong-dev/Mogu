import { apiRequest } from './client';
import { ApiError, type CatalogItem } from './types';

export type ProfileDashboard = {
  profile: {
    displayName: string | null;
    username: string | null;
    gender?: string | null;
    avatar: { url: string | null; blurHash: string | null; status: string };
    primaryGoal: { id: string; code: string; name: string } | null;
  };
  socialStats: {
    publishedPostCount: number;
    savedDishCount: number;
    followerCount: number;
    followingCount?: number;
  };
  journeyPreview: {
    currentStreakDays: number;
    mealsLoggedThisMonth: number;
    newDishesThisMonth: number;
    recentDays: Array<{ localDate: string; status: string }>;
    definitionVersion: string;
  };
  shortcuts: {
    savedDishes: number;
    randomRuns: number;
    mealLogsThisMonth: number;
    myPublishedPosts: number;
    myDraftPosts: number;
  };
  notificationUnreadCount: number;
  generatedAt: string;
};

// ─── Typed responses ─────────────────────────────────────────────────────────

export type ActivityLevel = 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE';

export type SelectionPriority = { code: string; weight: number };

export type AvoidedIngredient = {
  id?: string;
  name?: string;
  ingredientName?: string;
  ingredientId?: string | null;
  text?: string;
  mode?: 'HARD' | 'SOFT';
};

export type MeProfile = {
  version?: number;
  profileVersion?: number;
  basic?: {
    displayName?: string | null;
    username?: string | null;
    dateOfBirth?: string | null;
    gender?: string | null;
    bio?: string | null;
    region?: { id: string; code: string; name: string } | null;
    timezone?: string | null;
    locale?: string | null;
  };
  avatar?: { url?: string | null; thumbnailUrl?: string | null };
  healthSummary?: {
    latestHeightCm?: number | null;
    latestWeightKg?: number | null;
    [key: string]: unknown;
  };
  preferences?: {
    primaryGoal?: { id: string; code: string; name: string } | null;
    tastePreferences?: CatalogItem[];
    dietTypes?: CatalogItem[];
    selectionPriorities?: SelectionPriority[];
    allergens?: CatalogItem[];
    noAllergies?: boolean;
    avoidedIngredients?: AvoidedIngredient[];
  };
  displayName?: string | null;
  avatarUrl?: string | null;
  noAllergies?: boolean;
};

export type UserSettings = {
  version: number;
  notifications: {
    pushEnabled: boolean;
    mealReminders: boolean;
    waterReminders: boolean;
    weeklyPlanNotif: boolean;
    communityNotif: boolean;
    marketingNotif: boolean;
  };
  privacy: {
    shareData?: boolean;
    analytics?: boolean;
    analyticsEnabled?: boolean;
    profileVisibility?: 'PUBLIC' | 'PRIVATE' | string;
    showDietActivity?: boolean;
    allowComments?: boolean;
  };
  theme?: string;
  appTheme?: string;
  language?: string;
};

export type DailyTargets = {
  energyKcal?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  waterMl?: number | null;
  steps?: number | null;
  mode?: string;
  method?: string;
  formulaVersion?: string | null;
};

export type HealthProfile = {
  latestMeasurements?: {
    height?: { value: number; unit: string; measuredAt?: string } | null;
    weight?: { value: number; unit: string; measuredAt?: string } | null;
  };
  bmi?: { value: number | null; status: string; method?: string };
  targetWeight?: { value: number; unit: string } | null;
  targetWeightKg?: number | null;
  activityLevel?: ActivityLevel | string | null;
  profileVersion?: number;
  dailyTargets?: DailyTargets | null;
};

export type UpdateHealthResponse = {
  profileVersion?: number;
  healthProfile?: HealthProfile;
  targetStatus?: string;
  missingInputs?: string[];
  message?: string;
};

export type JourneyResponse = {
  month?: string;
  streak?: { currentDays?: number; longestDays?: number };
  currentStreakDays?: number;
  longestStreakDays?: number;
  achievements?: Array<{
    id?: string;
    code?: string;
    name: string;
    progress?: number;
    target?: number;
  }>;
  monthlyGoals?: Array<{ code?: string; label: string; current?: number; target?: number }>;
  days?: Array<{ localDate: string; status: string }>;
};

export type SessionItem = {
  sessionId: string;
  deviceLabel: string;
  platform: string;
  installationId?: string | null;
  lastSeenAt: string;
  isCurrent: boolean;
};

export type FollowUser = {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio?: string | null;
  isFollowing: boolean;
  followedAt?: string;
  cursorId?: string;
};

export type FollowListResponse = {
  items: FollowUser[];
  pageInfo: { nextCursor: string | null; hasNextPage: boolean };
};

export type ExportJob = {
  jobId: string;
  status: string;
  expiresAt?: string | null;
  download?: { url: string; resultUrl?: string; expiresAt?: string | null } | null;
  resultUrl?: string | null;
  downloadPath?: string;
  pollAfterMs?: number;
};

export type DeletionRequest = {
  jobId: string | null;
  status: string;
  graceEndsAt: string | null;
};

// ─── Version-conflict helper ─────────────────────────────────────────────────

export function isVersionConflict(e: unknown): e is ApiError {
  return (
    e instanceof ApiError &&
    e.status === 412 &&
    typeof e.code === 'string' &&
    e.code.endsWith('VERSION_CONFLICT')
  );
}

/**
 * Runs `mutate(version)`; if the server answers 412 *_VERSION_CONFLICT it refetches the
 * current version once and retries.
 */
export async function withVersionRetry<T>(
  fetchVersion: () => Promise<number>,
  mutate: (version: number) => Promise<T>,
  initialVersion?: number,
): Promise<T> {
  const first = initialVersion ?? (await fetchVersion());
  try {
    return await mutate(first);
  } catch (e) {
    if (!isVersionConflict(e)) throw e;
    const details = (e.details as any)?.error?.details ?? (e.details as any)?.details;
    const serverVersion = Number(details?.currentVersion);
    const next = Number.isFinite(serverVersion) && serverVersion > 0 ? serverVersion : await fetchVersion();
    return mutate(next);
  }
}

export const profileVersionOf = (me?: MeProfile | null) => me?.version ?? me?.profileVersion ?? 1;

const ifMatch = (version: number) => ({
  'If-Match': `"${version}"`,
  'x-profile-version': String(version),
});

export const profileApi = {
  dashboard: (params?: { localDate?: string; timezone?: string; weekStartsOn?: string }) => {
    const qs = new URLSearchParams();
    if (params?.localDate) qs.set('localDate', params.localDate);
    if (params?.timezone) qs.set('timezone', params.timezone);
    if (params?.weekStartsOn) qs.set('weekStartsOn', params.weekStartsOn);
    const q = qs.toString();
    return apiRequest<ProfileDashboard>(`/me/profile-dashboard${q ? `?${q}` : ''}`);
  },

  me: () => apiRequest<MeProfile>('/profile/me'),

  updateBasic: (data: unknown, version: number) =>
    apiRequest<MeProfile>('/profile/basic', {
      method: 'PATCH',
      headers: ifMatch(version),
      body: JSON.stringify(data),
    }),

  updateHealth: (
    data: {
      heightCm?: number;
      weightKg?: number;
      targetWeightKg?: number;
      activityLevel?: ActivityLevel;
    },
    version: number,
  ) =>
    apiRequest<UpdateHealthResponse>('/profile/health', {
      method: 'PATCH',
      headers: ifMatch(version),
      body: JSON.stringify(data),
    }),

  updatePreferences: (
    data: {
      primaryGoalId?: string;
      dietaryPreferenceIds?: string[];
      allergenIds?: string[];
      noAllergies?: boolean;
    },
    version: number,
  ) =>
    apiRequest<MeProfile & { profileVersion?: number }>('/profile/preferences', {
      method: 'PATCH',
      headers: ifMatch(version),
      body: JSON.stringify(data),
    }),

  putAvoidances: <T = Record<string, unknown>>(data: unknown) =>
    apiRequest<T>('/me/avoidances', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  putSelectionPriorities: (items: SelectionPriority[]) =>
    apiRequest<{ selectionPriorities: SelectionPriority[]; profileVersion: number }>(
      '/me/selection-priorities',
      { method: 'PUT', body: JSON.stringify({ items }) },
    ),

  getHealthProfile: () => apiRequest<HealthProfile>('/me/health-profile'),

  createAvatarIntent: <T = Record<string, unknown>>(data: unknown) =>
    apiRequest<T>('/me/avatar-upload-intents', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  finalizeAvatar: <T = Record<string, unknown>>(mediaId: string) =>
    apiRequest<T>(`/me/avatar-upload-intents/${mediaId}/finalize`, { method: 'POST' }),

  getAvatar: <T = Record<string, unknown>>() => apiRequest<T>('/me/avatar'),

  deleteAvatar: <T = Record<string, unknown>>(version: number) =>
    apiRequest<T>('/me/avatar', {
      method: 'DELETE',
      headers: { 'If-Match': `"${version}"` },
    }),

  getJourney: (month?: string, timezone?: string) => {
    const qs = new URLSearchParams();
    if (month) qs.set('month', month);
    if (timezone) qs.set('timezone', timezone);
    const q = qs.toString();
    return apiRequest<JourneyResponse>(`/me/journey${q ? `?${q}` : ''}`);
  },

  getSettings: () => apiRequest<UserSettings>('/me/settings'),

  updateSettings: (data: Record<string, unknown>, version: number = 1) =>
    apiRequest<UserSettings>('/me/settings', {
      method: 'PATCH',
      headers: { 'If-Match': `"${version}"` },
      body: JSON.stringify(data),
    }),

  requestDataExport: () => apiRequest<ExportJob>('/me/data-exports', { method: 'POST' }),

  getDataExport: (jobId: string) => apiRequest<ExportJob>(`/me/data-exports/${jobId}`),

  getExportContent: (jobId: string) =>
    apiRequest<Record<string, unknown>>(`/me/data-exports/${jobId}/content`),

  requestAccountDeletion: () =>
    apiRequest<DeletionRequest>('/me/account-deletion-requests', { method: 'POST' }),

  getAccountDeletion: () => apiRequest<DeletionRequest>('/me/account-deletion-request'),

  cancelAccountDeletion: () =>
    apiRequest<DeletionRequest>('/me/account-deletion-request', { method: 'DELETE' }),

  clearHistory: () => apiRequest('/me/random-history', { method: 'DELETE' }),

  clearHealth: () => apiRequest('/me/health-data', { method: 'DELETE' }),

  getFollowers: (params?: { cursor?: string; limit?: number; q?: string }) =>
    apiRequest<FollowListResponse>(`/me/followers${followQs(params)}`),

  getFollowing: (params?: { cursor?: string; limit?: number; q?: string }) =>
    apiRequest<FollowListResponse>(`/me/following${followQs(params)}`),

  getRegions: (q?: string, limit = 40) => {
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    qs.set('limit', String(limit));
    return apiRequest<{ items: Array<{ id: string; code: string; name: string }> }>(
      `/catalogs/regions?${qs.toString()}`,
    );
  },
};

function followQs(params?: { cursor?: string; limit?: number; q?: string }) {
  const qs = new URLSearchParams();
  if (params?.cursor) qs.set('cursor', params.cursor);
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.q) qs.set('q', params.q);
  const s = qs.toString();
  return s ? `?${s}` : '';
}
