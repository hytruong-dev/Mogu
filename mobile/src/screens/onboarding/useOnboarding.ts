import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onboardingApi } from '@/services/api/onboarding';
import type { CatalogItem, OnboardingCatalog } from '@/services/api/types';
import { getRandomAvatar } from '@/theme/default-avatars';
import { saveDefaultAvatarKey } from '@/services/api/storage';

/**
 * UI steps (5 màn câu hỏi + tổng kết) ↔ backend steps (8 bước, onboarding.service.ts):
 *   0 Welcome      ↔ 1 welcome
 *   1 About        ↔ 2 name (skip được) + 3 birthday (bắt buộc) + 4 gender (skip được)
 *   2 Body         ↔ 5 body (skip được)
 *   3 Goal         ↔ 6 goal (bắt buộc)
 *   4 Preferences  ↔ 7 preferences (skip được)
 *   5 Summary      ↔ 8 summary → POST /onboarding/complete
 * Mỗi màn lưu ngay khi bấm "Tiếp tục" để có thể resume nếu thoát giữa chừng.
 */
export const UI_STEP = { welcome: 0, about: 1, body: 2, goal: 3, prefs: 4, summary: 5 } as const;
export type UiStep = (typeof UI_STEP)[keyof typeof UI_STEP];
export const QUESTION_STEPS = 4; // about, body, goal, prefs

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export type OnboardingForm = {
  displayName: string;
  birthDay: number;
  birthMonth: number;
  birthYear: number;
  gender: Gender | null;
  heightCm: number;
  weightKg: number;
  bodySkipped: boolean;
  primaryGoalId: string | null;
  tasteIds: string[];
  dietIds: string[];
  allergenIds: string[];
  noAllergies: boolean;
  avoidIngredients: string[];
  prefsSkipped: boolean;
};

const INITIAL_FORM: OnboardingForm = {
  displayName: '',
  birthDay: 1,
  birthMonth: 1,
  birthYear: 2000,
  gender: null,
  heightCm: 165,
  weightKg: 58,
  bodySkipped: false,
  primaryGoalId: null,
  tasteIds: [],
  dietIds: [],
  allergenIds: [],
  noAllergies: false,
  avoidIngredients: [],
  prefsSkipped: false,
};

const EMPTY_CATALOG: OnboardingCatalog = {
  version: '',
  goals: [],
  dietaryPreferences: { taste: [], diet: [] },
  allergens: [],
};

export const daysInMonth = (month: number, year: number) => new Date(year, month, 0).getDate();

export function calcAge(day: number, month: number, year: number) {
  const now = new Date();
  let age = now.getFullYear() - year;
  if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) age--;
  return age;
}

export function calcBmi(heightCm: number, weightKg: number) {
  const m = heightCm / 100;
  return m > 0 ? Math.round((weightKg / (m * m)) * 10) / 10 : 0;
}

const backendToUiStep = (step: number): UiStep => {
  if (step <= 1) return UI_STEP.welcome;
  if (step <= 4) return UI_STEP.about;
  if (step === 5) return UI_STEP.body;
  if (step === 6) return UI_STEP.goal;
  if (step === 7) return UI_STEP.prefs;
  return UI_STEP.summary;
};

type Draft = Record<string, any>;

function formFromDraft(draft: Draft, catalog: OnboardingCatalog): Partial<OnboardingForm> {
  const out: Partial<OnboardingForm> = {};
  if (typeof draft.name?.displayName === 'string') out.displayName = draft.name.displayName;
  const dob = draft.birthday?.dateOfBirth;
  if (typeof dob === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dob)) {
    const [y, m, d] = dob.slice(0, 10).split('-').map(Number);
    Object.assign(out, { birthYear: y, birthMonth: m, birthDay: d });
  }
  if (['MALE', 'FEMALE', 'OTHER'].includes(draft.gender?.gender)) out.gender = draft.gender.gender;
  if (typeof draft.body?.heightCm === 'number') out.heightCm = draft.body.heightCm;
  if (typeof draft.body?.weightKg === 'number') out.weightKg = draft.body.weightKg;
  if (draft.body_skipped) out.bodySkipped = true;
  if (typeof draft.goal?.primaryGoalId === 'string') out.primaryGoalId = draft.goal.primaryGoalId;
  const prefs = draft.preferences;
  if (prefs) {
    const ids: string[] = prefs.dietaryPreferenceIds ?? [];
    const tasteSet = new Set(catalog.dietaryPreferences.taste.map((t) => t.id));
    out.tasteIds = ids.filter((id) => tasteSet.has(id));
    out.dietIds = ids.filter((id) => !tasteSet.has(id));
    out.allergenIds = prefs.allergenIds ?? [];
    out.noAllergies = !!prefs.noAllergies;
    out.avoidIngredients = prefs.avoidIngredients ?? [];
  }
  return out;
}

const errMsg = (e: unknown, fallback: string) =>
  e instanceof Error && e.message ? e.message : fallback;

export function useOnboarding(onFinish: () => void) {
  const [form, setForm] = useState<OnboardingForm>(INITIAL_FORM);
  const [catalog, setCatalog] = useState<OnboardingCatalog>(EMPTY_CATALOG);
  const [catalogState, setCatalogState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [resumeStep, setResumeStep] = useState<UiStep | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const version = useRef(1);

  const patch = useCallback(
    (p: Partial<OnboardingForm>) => setForm((f) => ({ ...f, ...p })),
    [],
  );

  const load = useCallback(async () => {
    setCatalogState('loading');
    try {
      const started: any = await onboardingApi.start();
      if (started?.alreadyCompleted) {
        onFinish();
        return;
      }
      const [state, cat] = await Promise.all([onboardingApi.state(), onboardingApi.catalog()]);
      version.current = state.profileVersion ?? 1;
      setCatalog(cat);
      setForm((f) => ({ ...f, ...formFromDraft(state.draft ?? {}, cat) }));
      if (state.currentStep > 1) setResumeStep(backendToUiStep(state.currentStep));
      setCatalogState('ready');
    } catch {
      setCatalogState('error');
    }
  }, [onFinish]);

  useEffect(() => {
    load();
  }, [load]);

  /** Gọi API có kèm profileVersion; nếu conflict (409) thì lấy version mới và thử lại 1 lần. */
  const withVersion = useCallback(async (run: (v: number) => Promise<any>) => {
    try {
      const res = await run(version.current);
      if (typeof res?.profileVersion === 'number') version.current = res.profileVersion;
      return res;
    } catch (e: any) {
      if (e?.status !== 409) throw e;
      const fresh = await onboardingApi.state();
      version.current = fresh.profileVersion;
      const res = await run(version.current);
      if (typeof res?.profileVersion === 'number') version.current = res.profileVersion;
      return res;
    }
  }, []);

  const guard = useCallback(async (fn: () => Promise<void>, fallback: string) => {
    setSaving(true);
    setError('');
    try {
      await fn();
      return true;
    } catch (e) {
      setError(errMsg(e, fallback));
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const saveAbout = () =>
    guard(async () => {
      const name = form.displayName.trim();
      if (name) await withVersion((v) => onboardingApi.saveStep(2, { displayName: name }, v));
      else await onboardingApi.skipStep(2);

      const dob = `${form.birthYear}-${String(form.birthMonth).padStart(2, '0')}-${String(form.birthDay).padStart(2, '0')}`;
      await withVersion((v) => onboardingApi.saveStep(3, { dateOfBirth: dob }, v));

      if (form.gender) {
        await withVersion((v) => onboardingApi.saveStep(4, { gender: form.gender }, v));
        saveDefaultAvatarKey(getRandomAvatar(form.gender).id).catch(() => undefined);
      } else {
        await onboardingApi.skipStep(4);
      }
    }, 'Không thể lưu thông tin cá nhân.');

  const saveBody = (skip = false) =>
    guard(async () => {
      if (skip) {
        await onboardingApi.skipStep(5);
        patch({ bodySkipped: true });
        return;
      }
      await withVersion((v) =>
        onboardingApi.saveStep(5, { heightCm: form.heightCm, weightKg: form.weightKg }, v),
      );
      patch({ bodySkipped: false });
    }, 'Không thể lưu chiều cao, cân nặng.');

  const saveGoal = () =>
    guard(async () => {
      if (!form.primaryGoalId) throw new Error('Hãy chọn một mục tiêu chính.');
      await withVersion((v) =>
        onboardingApi.saveStep(6, { primaryGoalId: form.primaryGoalId, secondaryGoalIds: [] }, v),
      );
    }, 'Không thể lưu mục tiêu.');

  const savePrefs = (skip = false) =>
    guard(async () => {
      if (skip) {
        await onboardingApi.skipStep(7);
        patch({ prefsSkipped: true });
        return;
      }
      await withVersion((v) =>
        onboardingApi.saveStep(
          7,
          {
            dietaryPreferenceIds: [...form.tasteIds, ...form.dietIds],
            noAllergies: form.noAllergies,
            allergenIds: form.noAllergies ? [] : form.allergenIds,
            avoidIngredients: form.avoidIngredients,
          },
          v,
        ),
      );
      patch({ prefsSkipped: false });
    }, 'Không thể lưu sở thích ăn uống.');

  const complete = () =>
    guard(async () => {
      await withVersion((v) => onboardingApi.complete(v));
      onFinish();
    }, 'Không thể hoàn tất onboarding.');

  const lookup = useMemo(() => {
    const byId = new Map<string, CatalogItem>();
    [
      ...catalog.goals,
      ...catalog.dietaryPreferences.taste,
      ...catalog.dietaryPreferences.diet,
      ...catalog.allergens,
    ].forEach((i) => byId.set(i.id, i));
    return (ids: string[]) => ids.map((id) => byId.get(id)?.name).filter(Boolean) as string[];
  }, [catalog]);

  return {
    form,
    patch,
    catalog,
    catalogState,
    reloadCatalog: load,
    resumeStep,
    clearResume: () => setResumeStep(null),
    saving,
    error,
    clearError: () => setError(''),
    saveAbout,
    saveBody,
    saveGoal,
    savePrefs,
    complete,
    lookup,
  };
}

export type OnboardingController = ReturnType<typeof useOnboarding>;
