import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { apiRequest } from './client';

export type CookingVoiceAudio = { text: string; audioUrl: string | null };
export type CookingVoiceScript = {
  dishId: string;
  dishName: string;
  greeting: CookingVoiceAudio;
  ingredients: CookingVoiceAudio;
  steps: (CookingVoiceAudio & { stepOrder: number })[];
};
export type CookingVoiceServerAction = {
  type:
    | 'NEXT'
    | 'PREV'
    | 'GOTO'
    | 'START_TIMER'
    | 'PAUSE_TIMER'
    | 'READ_INGREDIENTS'
    | 'REPEAT'
    | 'SET_TIMER';
  stepIndex?: number;
  seconds?: number;
};
export type CookingVoiceAskPayload = {
  dishId: string;
  question: string;
  currentStep: number;
  timerRemainingSec?: number;
  servings?: number;
};
export type CookingVoiceAnswer = {
  answer: string;
  action?: CookingVoiceServerAction;
  audioUrl?: string | null;
};
// v3 drops old script audio after the NOAN voice-profile change. Keep original server URLs.
const scriptKey = (id: string) => `cooking-voice-script:v3:${id}`;
const audioDownloads = new Map<string, Promise<string>>();
// Deterministic filename; collisions are checked through the separate URL index.
function hash(value: string): string {
  let a = 2166136261;
  let b = 5381;
  for (let i = 0; i < value.length; i++) {
    a = Math.imul(a ^ value.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ value.charCodeAt(i);
  }
  return `${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}`;
}
/** Look up audio lazily; validate existence since the OS may evict cache files. */
export async function getCachedCookingScriptAudio(url: string): Promise<string> {
  if (/^file:\/\//i.test(url)) {
    if ((await FileSystem.getInfoAsync(url)).exists) return url;
    throw new Error('Âm thanh lưu trên thiết bị đã hết hạn.');
  }
  if (!/^https?:\/\//i.test(url) || !FileSystem.cacheDirectory) return url;
  const path = `${FileSystem.cacheDirectory}cooking-voice-${hash(url)}.mp3`;
  const key = `cooking-voice-audio:v1:${hash(url)}`;
  try {
    if ((await AsyncStorage.getItem(key)) === url) {
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists && !info.isDirectory && info.size > 0) return path;
    }
  } catch {
    /* A cache failure must not block remote playback. */
  }
  return url;
}
/** Optional lazy public-script cache. No startup prefetch, two concurrent downloads,
 * 12s timeout and cancelable native tasks. Private answers are never persisted here.
 */
export async function cacheCookingScriptAudio(url: string, signal?: AbortSignal): Promise<string> {
  if (!/^https?:\/\//i.test(url) || !FileSystem.cacheDirectory || signal?.aborted) return url;
  const cached = await getCachedCookingScriptAudio(url);
  if (cached !== url || signal?.aborted) return cached;
  // Do not join another session's cancelable task or build an unbounded queue.
  if (audioDownloads.has(url) || audioDownloads.size >= 2) return url;
  const path = `${FileSystem.cacheDirectory}cooking-voice-${hash(url)}.mp3`;
  const download = (async () => {
    const task = FileSystem.createDownloadResumable(url, path);
    let canceled = false;
    let cancelDownload: () => void = () => {};
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const stopped = new Promise<never>((_, reject) => {
      cancelDownload = () => {
        if (canceled) return;
        canceled = true;
        void task.cancelAsync().catch(() => {});
        reject(new Error('Audio download canceled'));
      };
      timeout = setTimeout(cancelDownload, 12000);
      signal?.addEventListener('abort', cancelDownload, { once: true });
    });
    try {
      if (signal?.aborted) cancelDownload();
      const result = await Promise.race([task.downloadAsync(), stopped]);
      if (canceled || signal?.aborted || result?.status !== 200)
        throw new Error('Không tải được giọng NOAN.');
      await AsyncStorage.setItem(`cooking-voice-audio:v1:${hash(url)}`, url);
      return result.uri;
    } finally {
      if (timeout) clearTimeout(timeout);
      signal?.removeEventListener('abort', cancelDownload);
    }
  })();
  audioDownloads.set(url, download);
  try {
    return await download;
  } finally {
    audioDownloads.delete(url);
  }
}
export const cookingVoiceApi = {
  async getScript(dishId: string, signal?: AbortSignal): Promise<CookingVoiceScript> {
    const key = scriptKey(dishId);
    let script: CookingVoiceScript;
    try {
      script = await apiRequest<CookingVoiceScript>(
        `/cooking-voice/dishes/${encodeURIComponent(dishId)}/script`,
        { signal },
      );
    } catch (error) {
      if (signal?.aborted) throw error;
      const cached = await AsyncStorage.getItem(key);
      if (!cached) throw error;
      script = JSON.parse(cached) as CookingVoiceScript;
    }
    if (signal?.aborted) throw new Error('Request aborted');
    // Persist raw server URLs separately from the audio index. No download barrier.
    void AsyncStorage.setItem(key, JSON.stringify(script)).catch(() => {});
    return script;
  },
  tts(text: string, rate?: number, signal?: AbortSignal): Promise<CookingVoiceAudio> {
    return apiRequest('/cooking-voice/tts', {
      method: 'POST',
      body: JSON.stringify({ text, ...(rate === undefined ? {} : { rate }) }),
      signal,
    });
  },
  ask(payload: CookingVoiceAskPayload, signal?: AbortSignal): Promise<CookingVoiceAnswer> {
    return apiRequest('/cooking-voice/ask', {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
    });
  },
};
