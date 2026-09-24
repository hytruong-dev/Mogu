import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Dish } from '../../services/api/dishes';
import { normalizeImageUrl } from '../../services/api/randomization';

const RECENT_KEY = 'mogu.explore.recentSearches';
const MAX_RECENT = 8;

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const diff = Math.max(0, Date.now() - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Vừa xong';
  if (min < 60) return `${min} phút`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} giờ`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} ngày`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

export function formatPriceK(min: number | null | undefined, max: number | null | undefined): string | null {
  if (min == null && max == null) return null;
  const a = min ?? max ?? 0;
  const b = max ?? min ?? 0;
  const toK = (n: number) => `${Math.round(n / 1000)}K`;
  if (a === b) return toK(a);
  return `${toK(Math.min(a, b))}–${toK(Math.max(a, b))}`;
}

export function formatDishMeta(dish: Dish): string {
  const parts: string[] = [];
  const total = (dish.prepMinutes ?? 0) + (dish.cookMinutes ?? 0);
  if (total > 0) parts.push(`${total} phút`);
  else if (dish.prepMinutes) parts.push(`${dish.prepMinutes} phút`);
  const price = formatPriceK(dish.priceMin, dish.priceMax);
  if (price) parts.push(price);
  const kcal = dish.calories ?? dish.nutritionProfiles?.[0]?.calories;
  if (kcal) parts.push(`${Math.round(Number(kcal))} kcal`);
  return parts.join(' · ');
}

export function resolveDishImageUrl(dish: Dish): string | null {
  const anyDish = dish as Dish & { imageUrl?: string | null };
  if (anyDish.imageUrl) return normalizeImageUrl(anyDish.imageUrl);
  if (dish.thumbnailUrl) return normalizeImageUrl(dish.thumbnailUrl);
  const media = dish.media ?? [];
  const primary = media.find((m) => m.isPrimary) ?? media[0];
  if (!primary) return null;
  const withUrl = primary as { publicUrl?: string; storageKey: string; bucket?: string };
  if (withUrl.publicUrl) return normalizeImageUrl(withUrl.publicUrl);
  const base = (
    (
      globalThis as typeof globalThis & {
        process?: { env?: Record<string, string | undefined> };
      }
    ).process?.env?.EXPO_PUBLIC_SUPABASE_URL ?? ''
  ).replace(/\/$/, '');
  if (!base || !primary.storageKey) return null;
  return `${base}/storage/v1/object/public/${primary.bucket || 'dish-images'}/${primary.storageKey}`;
}

export function formatCount(n: number | null | undefined): string {
  const v = n ?? 0;
  if (v >= 1000) {
    const k = v / 1000;
    return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}K`;
  }
  return String(v);
}

export type MdBlock =
  | { type: 'h2' | 'h3' | 'p'; text: string }
  | { type: 'hr' };

/** Strip raw Markdown markers into readable blocks for the article reader. */
export function parseMarkdownBlocks(raw: string): MdBlock[] {
  const text = (raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .trim();
  if (!text) return [];

  const lines = text.split('\n');
  const blocks: MdBlock[] = [];
  let para: string[] = [];

  const flushPara = () => {
    const p = para.join(' ').trim();
    if (p) blocks.push({ type: 'p', text: p });
    para = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushPara();
      continue;
    }
    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      flushPara();
      blocks.push({ type: 'hr' });
      continue;
    }
    const h2 = trimmed.match(/^##\s+(.*)$/);
    if (h2) {
      flushPara();
      blocks.push({ type: 'h2', text: h2[1].trim() });
      continue;
    }
    const h3 = trimmed.match(/^###\s+(.*)$/);
    if (h3) {
      flushPara();
      blocks.push({ type: 'h3', text: h3[1].trim() });
      continue;
    }
    const h1 = trimmed.match(/^#\s+(.*)$/);
    if (h1) {
      flushPara();
      blocks.push({ type: 'h2', text: h1[1].trim() });
      continue;
    }
    // Numbered section headings like "1. Cơm và sườn", "2. Combo “chuẩn tiệm”"
    const numberedSection = trimmed.match(/^(\d+\.\s+[A-ZÀ-Ỹa-zà-ỹ0-9“"'].*)$/);
    if (numberedSection && trimmed.length < 60 && !/[;,.]$/.test(trimmed)) {
      flushPara();
      blocks.push({ type: 'h2', text: numberedSection[1].trim() });
      continue;
    }
    para.push(trimmed.replace(/^[-*]\s+/, ''));
  }
  flushPara();
  return blocks;
}

export async function loadRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function pushRecentSearch(q: string): Promise<string[]> {
  const term = q.trim();
  if (!term) return loadRecentSearches();
  const prev = await loadRecentSearches();
  const next = [term, ...prev.filter((x) => x.toLowerCase() !== term.toLowerCase())].slice(
    0,
    MAX_RECENT,
  );
  await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

export async function removeRecentSearch(q: string): Promise<string[]> {
  const prev = await loadRecentSearches();
  const next = prev.filter((x) => x !== q);
  await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

export async function clearRecentSearches(): Promise<void> {
  await AsyncStorage.removeItem(RECENT_KEY);
}
