import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const KEY = 'mogu.installationId';
let memo: string | null = null;
let pending: Promise<string> | null = null;

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Persistent per-install UUID so the backend can mark the "current device" session. */
export function getInstallationId(): Promise<string> {
  if (memo) return Promise.resolve(memo);
  if (!pending) {
    pending = (async () => {
      try {
        const stored = await AsyncStorage.getItem(KEY);
        if (stored) {
          memo = stored;
          return stored;
        }
      } catch {
        /* ignore */
      }
      const fresh = uuid();
      memo = fresh;
      try {
        await AsyncStorage.setItem(KEY, fresh);
      } catch {
        /* ignore */
      }
      return fresh;
    })().finally(() => {
      pending = null;
    });
  }
  return pending;
}

export function getDeviceModel(): string {
  const c = Platform.constants as any;
  const raw = c?.Model ?? c?.systemName ?? c?.model ?? '';
  // Header values must be ASCII.
  return String(raw).replace(/[^\x20-\x7E]/g, '').slice(0, 60);
}
