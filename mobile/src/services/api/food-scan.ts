import { Image, Platform } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { apiRequest } from './client';

export type FoodScanCandidate = {
  dishId: string;
  name: string;
  imageUrl: string | null;
  score: number;
  matchSource?: 'PHASH' | 'RRF' | 'RERANK' | 'LEXICAL';
  confidenceLabel?: 'HIGH' | 'MEDIUM' | 'LOW';
  nutrition: {
    calories: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    servingName: string | null;
    servingG: number | null;
    basis: string | null;
  };
};
export type FoodScanResponse = {
  scanId: string;
  status: 'MATCHED' | 'SUGGESTIONS' | 'UNKNOWN_DISH' | 'NO_MATCH' | 'NOT_FOOD';
  recognizedName: string | null;
  confidence: number;
  matchSource?: 'PHASH' | 'RRF' | 'RERANK' | 'LEXICAL';
  candidates: FoodScanCandidate[];
  model: string;
  /** Present when the backend auto-queued this photo for admins (unknown dish). */
  reportId?: string;
};

export async function sendFoodScanFeedback(
  scanId: string,
  feedback: { dishId?: string | null; correct: boolean },
): Promise<{ success: boolean }> {
  try {
    return await apiRequest<{ success: boolean }>(`/food-scan/${scanId}/feedback`, {
      method: 'POST',
      body: JSON.stringify(feedback),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch {
    // Non-blocking telemetry
    return { success: false };
  }
}

/** Resize to max 1024px, re-encode as JPEG and wrap into a multipart form (`file`). */
async function buildFoodScanForm(
  uri: string,
  signal: AbortSignal | undefined,
  checkCancelled: () => void = () => {},
): Promise<FormData> {
  checkCancelled();
  // Callback form works on native and react-native-web (web has no promise overload).
  const size = await new Promise<{ width: number; height: number }>((resolve, reject) =>
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject),
  );
  checkCancelled();
  const longest = Math.max(size.width, size.height);
  const actions =
    longest > 1024
      ? [{ resize: size.width >= size.height ? { width: 1024 } : { height: 1024 } }]
      : [];
  const image = await manipulateAsync(uri, actions, { compress: 0.75, format: SaveFormat.JPEG });
  checkCancelled();
  const form = new FormData();
  if (Platform.OS === 'web') {
    const response = await fetch(image.uri, { signal });
    const blob = await response.blob();
    checkCancelled();
    if (blob.size > 5 * 1024 * 1024) throw new Error('Ảnh vượt quá 5 MB. Vui lòng chọn ảnh nhỏ hơn.');
    form.append('file', blob, 'food-scan.jpg');
  } else {
    const file = new File(image.uri);
    const bytes = await file.bytes();
    checkCancelled();
    if (bytes.byteLength > 5 * 1024 * 1024)
      throw new Error('Ảnh vượt quá 5 MB. Vui lòng chọn ảnh nhỏ hơn.');
    // Expo's fetch (WinterCG) requires Blob or an object with bytes(): Uint8Array.
    // Passing legacy { uri, name, type } throws 'Unsupported FormDataPart implementation'.
    const filePart = {
      name: 'food-scan.jpg',
      type: 'image/jpeg',
      bytes: () => bytes,
    };
    form.append('file', filePart as unknown as Blob);
  }
  return form;
}

/**
 * User says "this dish is not in Mogu": queue the photo for admins.
 * Falls back to a JSON request (server reuses the auto-report) if the photo can't be prepared.
 */
export async function reportMissingDish(
  scanId: string,
  photoUri?: string | null,
): Promise<{ success: boolean; reportId: string | null }> {
  let body: FormData | string = JSON.stringify({});
  let headers: Record<string, string> | undefined = { 'Content-Type': 'application/json' };
  if (photoUri) {
    try {
      body = await buildFoodScanForm(photoUri, undefined);
      headers = undefined;
    } catch {
      // keep JSON fallback
    }
  }
  try {
    const res = await apiRequest<{ success: boolean; reportId: string | null }>(
      `/food-scan/${scanId}/report-missing`,
      { method: 'POST', body, headers },
    );
    return { success: Boolean(res?.success && res?.reportId), reportId: res?.reportId ?? null };
  } catch {
    return { success: false, reportId: null };
  }
}

/** JPEG upload; the single timeout includes preparation and the network request. */
export async function scanFoodImage(uri: string, signal?: AbortSignal): Promise<FoodScanResponse> {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    abort();
  }, 45_000);
  const checkCancelled = () => {
    if (controller.signal.aborted)
      throw new Error(timedOut ? 'Phân tích quá lâu. Vui lòng thử lại.' : 'Đã hủy quét ảnh.');
  };
  // Some native preparation operations cannot be interrupted; reject immediately and
  // guard every continuation so cancellation never starts a later upload.
  const prepareAndScan = async () => {
    const form = await buildFoodScanForm(uri, controller.signal, checkCancelled);
    checkCancelled();
    return apiRequest<FoodScanResponse>('/food-scan/recognize', {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
  };
  let onAbort: (() => void) | undefined;
  try {
    return await Promise.race([
      prepareAndScan(),
      new Promise<never>((_, reject) => {
        onAbort = () =>
          reject(new Error(timedOut ? 'Phân tích quá lâu. Vui lòng thử lại.' : 'Đã hủy quét ảnh.'));
        controller.signal.addEventListener('abort', onAbort, { once: true });
        if (controller.signal.aborted) onAbort();
      }),
    ]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    if (onAbort) controller.signal.removeEventListener('abort', onAbort);
  }
}
