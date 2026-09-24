/**
 * Meal reminders — nhắc giờ ăn trước 30 phút theo mealSlotSchedule + plan ACTIVE
 */
/**
 * Meal reminders — nhắc giờ ăn trước 30 phút theo mealSlotSchedule + plan ACTIVE
 * Lưu ý: Expo SDK 53+ không hỗ trợ notifications trong Expo Go trên Android
 * (ném lỗi runtime khi import expo-notifications). Dùng dynamic require và guard
 * isRunningInExpoGo để an toàn trên Expo Go và chạy bình thường trên Development Build / Production.
 */
import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import type { WeeklyMealSlot, WeeklyPlan, WeeklyPlanConfig } from '../services/api/types';
import { getSession } from '../services/api/storage';
import { profileApi } from '../services/api/profile';
import { getCurrentWeeklyPlan, getWeeklyPlanConfig } from '../services/api/weekly-plan';

type NotificationsModule = typeof import('expo-notifications');

let cachedNotifications: NotificationsModule | null = null;
let handlerConfigured = false;

function getNotificationsModule(): NotificationsModule | null {
  // Expo SDK 53+ chặn hoàn toàn expo-notifications trên Android khi chạy trong Expo Go
  if (Platform.OS === 'android' && isRunningInExpoGo()) {
    return null;
  }
  if (cachedNotifications) {
    return cachedNotifications;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-notifications') as NotificationsModule;
    if (mod && !handlerConfigured && typeof mod.setNotificationHandler === 'function') {
      mod.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      handlerConfigured = true;
    }
    cachedNotifications = mod;
    return cachedNotifications;
  } catch (err) {
    if (__DEV__) {
      console.warn('[meal-reminders] expo-notifications is not available in this runtime:', err);
    }
    return null;
  }
}

const REMINDER_LEAD_MINUTES = 30;
const CHANNEL_ID = 'mogu-meal-reminders';

const SLOT_LABEL: Record<string, string> = {
  MORNING: 'Bữa sáng',
  BREAKFAST: 'Bữa sáng',
  LUNCH: 'Bữa trưa',
  DINNER: 'Bữa tối',
  SNACK: 'Bữa phụ',
};

const DEFAULT_TIMES: Record<string, string> = {
  MORNING: '07:00',
  BREAKFAST: '07:00',
  LUNCH: '12:00',
  DINNER: '18:30',
  SNACK: '15:00',
};

async function ensurePermissions(notifications: NotificationsModule): Promise<boolean> {
  try {
    const current = await notifications.getPermissionsAsync();
    if (current.granted || current.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL) {
      return true;
    }
    const requested = await notifications.requestPermissionsAsync();
    return !!(
      requested.granted ||
      requested.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL
    );
  } catch {
    return false;
  }
}

async function ensureAndroidChannel(notifications: NotificationsModule) {
  if (Platform.OS !== 'android') return;
  try {
    await notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Nhắc giờ ăn',
      importance: notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
    });
  } catch {
    // ignore
  }
}

function parseTime(time: string | null | undefined, slot: string): { hour: number; minute: number } {
  const raw = (time && /^\d{1,2}:\d{2}$/.test(time) ? time : DEFAULT_TIMES[slot]) ?? '12:00';
  const [h, m] = raw.split(':').map((x) => parseInt(x, 10));
  return {
    hour: Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 12,
    minute: Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0,
  };
}

function toLocalDate(isoDate: string, hour: number, minute: number): Date {
  const [y, mo, d] = isoDate.slice(0, 10).split('-').map(Number);
  return new Date(y, mo - 1, d, hour, minute, 0, 0);
}

/**
 * Huỷ toàn bộ reminder meal trước đó rồi lên lịch lại cho plan ACTIVE.
 * Nhắc trước 30 phút mỗi bữa còn PLANNED.
 */
export async function syncMealReminders(
  plan: WeeklyPlan | null | undefined,
  config?: WeeklyPlanConfig | null,
  enabled: boolean = true,
): Promise<number> {
  const notifications = getNotificationsModule();
  if (!notifications) return 0;

  await cancelMealReminders();

  if (!enabled || !plan || plan.status !== 'ACTIVE') return 0;

  const allowed = await ensurePermissions(notifications);
  if (!allowed) return 0;

  await ensureAndroidChannel(notifications);

  const scheduleMap = new Map<string, string | null>();
  for (const row of config?.mealSlotSchedule ?? []) {
    scheduleMap.set(row.type, row.time);
  }

  const now = Date.now();
  let scheduled = 0;

  for (const day of plan.days ?? []) {
    const dateIso = (day.date ?? '').slice(0, 10);
    if (!dateIso) continue;

    for (const slot of day.slots ?? []) {
      if (slot.status !== 'PLANNED') continue;
      const mealSlot = slot.mealSlot as WeeklyMealSlot | string;
      const { hour, minute } = parseTime(scheduleMap.get(mealSlot as WeeklyMealSlot), mealSlot);
      const mealAt = toLocalDate(dateIso, hour, minute);
      const fireAt = new Date(mealAt.getTime() - REMINDER_LEAD_MINUTES * 60_000);
      if (fireAt.getTime() <= now) continue;

      const label = SLOT_LABEL[mealSlot] ?? 'Bữa ăn';
      const dishName = slot.dish?.name || 'món hôm nay';

      try {
        await notifications.scheduleNotificationAsync({
          content: {
            title: `Sắp đến ${label}`,
            body: `${dishName} · bắt đầu sau ${REMINDER_LEAD_MINUTES} phút`,
            data: {
              type: 'meal_reminder',
              planId: plan.id,
              slotId: slot.id,
              date: dateIso,
              mealSlot,
            },
            ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
          },
          trigger: {
            type: notifications.SchedulableTriggerInputTypes.DATE,
            date: fireAt,
          },
        });
        scheduled += 1;
      } catch (err) {
        if (__DEV__) {
          console.warn('[meal-reminders] failed to schedule notification:', err);
        }
      }
    }
  }

  return scheduled;
}

/**
 * Fetch current active plan, config, and user settings, then schedule reminders.
 * Call this on app open or when meal reminders setting is toggled.
 */
export async function syncCurrentMealReminders(): Promise<number> {
  try {
    const session = await getSession();
    if (!session?.accessToken) {
      await cancelMealReminders();
      return 0;
    }

    let mealRemindersEnabled = true;
    try {
      const settings = await profileApi.getSettings<any>();
      if (settings?.notifications?.mealReminders === false) {
        mealRemindersEnabled = false;
      }
    } catch {
      // Default to true
    }

    if (!mealRemindersEnabled) {
      await cancelMealReminders();
      return 0;
    }

    const [plan, config] = await Promise.all([
      getCurrentWeeklyPlan().catch(() => null),
      getWeeklyPlanConfig().catch(() => null),
    ]);

    if (!plan || plan.status !== 'ACTIVE') {
      await cancelMealReminders();
      return 0;
    }

    return await syncMealReminders(plan, config, true);
  } catch (err) {
    if (__DEV__) {
      console.warn('[meal-reminders] syncCurrentMealReminders failed:', err);
    }
    return 0;
  }
}

export async function cancelMealReminders(): Promise<void> {
  const notifications = getNotificationsModule();
  if (!notifications) return;

  try {
    const pending = await notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      pending
        .filter((n) => n.content?.data?.type === 'meal_reminder')
        .map((n) => notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch {
    // ignore
  }
}
