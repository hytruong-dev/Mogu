import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from './types';
import type { ProfileDashboard } from './profile';

const SESSION_KEY = '@mogu/session';
const PROFILE_DASHBOARD_KEY = '@mogu/profile_dashboard_cache';

export async function getSession(): Promise<Session | null> {
  const value = await AsyncStorage.getItem(SESSION_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as Session;
  } catch {
    await AsyncStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export async function saveSession(session: Session) {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession() {
  await AsyncStorage.multiRemove([SESSION_KEY, PROFILE_DASHBOARD_KEY]);
}

export async function getCachedProfileDashboard(): Promise<ProfileDashboard | null> {
  try {
    const value = await AsyncStorage.getItem(PROFILE_DASHBOARD_KEY);
    if (!value) return null;
    return JSON.parse(value) as ProfileDashboard;
  } catch {
    return null;
  }
}

export async function saveCachedProfileDashboard(data: ProfileDashboard): Promise<void> {
  try {
    await AsyncStorage.setItem(PROFILE_DASHBOARD_KEY, JSON.stringify(data));
  } catch {
    // Non-fatal
  }
}
