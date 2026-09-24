import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import { homeApi } from '../services/api/home';
import { getSession } from '../services/api/storage';

let lastRegisteredInstallationId: string | null = null;

export async function registerPushNotificationsAsync(): Promise<string | null> {
  const session = await getSession();
  if (!session?.accessToken) return null;

  // Safeguard against Expo Go Android limitation with expo-notifications
  if (Platform.OS === 'android' && isRunningInExpoGo()) {
    if (__DEV__) {
      console.log('[push-notifications] Running in Expo Go on Android; remote push registration skipped.');
    }
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require('expo-notifications');
    if (!Notifications || typeof Notifications.getPermissionsAsync !== 'function') {
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted' && typeof Notifications.requestPermissionsAsync === 'function') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      if (__DEV__) {
        console.log('[push-notifications] Notification permissions not granted.');
      }
      return null;
    }

    if (typeof Notifications.getExpoPushTokenAsync !== 'function') {
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync().catch((err: any) => {
      if (__DEV__) {
        console.warn('[push-notifications] Failed to fetch Expo push token:', err?.message);
      }
      return null;
    });

    if (!tokenData?.data) return null;

    const token = tokenData.data;
    if (__DEV__) {
      console.log('[push-notifications] Acquired push token:', token);
    }

    const res: any = await homeApi.registerPushInstallation({
      token,
      platform: Platform.OS.toUpperCase(),
      appVersion: '1.0.0',
    }).catch((err) => {
      if (__DEV__) {
        console.warn('[push-notifications] Failed to save push installation in backend:', err?.message);
      }
      return null;
    });

    if (res?.id) {
      lastRegisteredInstallationId = res.id;
    }

    return token;
  } catch (err: any) {
    if (__DEV__) {
      console.warn('[push-notifications] Registration error:', err?.message);
    }
    return null;
  }
}

export async function unregisterPushNotificationsAsync(): Promise<void> {
  if (lastRegisteredInstallationId) {
    await homeApi.unregisterPushInstallation(lastRegisteredInstallationId).catch(() => null);
    lastRegisteredInstallationId = null;
  }
}
