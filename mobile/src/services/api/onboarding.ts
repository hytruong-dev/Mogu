import { apiRequest } from './client';
import type { OnboardingCatalog, OnboardingState } from './types';

type StepResult = { profileVersion: number; nextStep: number | null };

export const onboardingApi = {
  catalog: () => apiRequest<OnboardingCatalog>('/catalogs/onboarding'),
  state: () => apiRequest<OnboardingState>('/onboarding'),
  start: () => apiRequest('/onboarding/start', { method: 'POST', body: '{}' }),
  saveStep: (step: number, data: unknown, profileVersion: number) =>
    apiRequest<StepResult>(`/onboarding/steps/${step}`, {
      method: 'PATCH',
      headers: { 'x-profile-version': String(profileVersion) },
      body: JSON.stringify(data),
    }),
  skipStep: (step: number) =>
    apiRequest(`/onboarding/steps/${step}/skip`, { method: 'POST', body: '{}' }),
  summary: () => apiRequest('/onboarding/summary'),
  complete: (profileVersion: number) =>
    apiRequest('/onboarding/complete', {
      method: 'POST',
      headers: { 'x-profile-version': String(profileVersion) },
      body: '{}',
    }),
};
