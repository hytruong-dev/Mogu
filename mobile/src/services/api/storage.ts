import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from './types';

const SESSION_KEY = '@mogu/session';

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
  await AsyncStorage.removeItem(SESSION_KEY);
}
