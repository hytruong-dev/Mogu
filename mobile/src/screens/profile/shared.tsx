import { type ReactNode } from 'react';
import { Alert, Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { StyledPressable as Pressable } from '../../components/ui/styled-pressable';
import { normalizeImageUrl } from '../../services/api/randomization';
import { P, PButton, PCard, EmptyBlock } from './ProfileUI';
import { getDeviceTimeZone, getTodayISO } from '../../lib/dates';
import { FormRowsSkeleton, JourneySkeleton, ListSkeleton, ProfileEditSkeleton, RandomHistorySkeleton, FoodListSkeleton } from '../../components/skeletons/ScreenSkeletons';
import { Check, ChevronRight, X } from '@/components/icons';

export const dishPlaceholder = require('../../assets/images/random/pho-result.jpg');

export function errMsg(e: unknown, fallback = 'Đã xảy ra lỗi.') {
  return (e as { message?: string })?.message ?? fallback;
}

export const GENDER_OPTIONS = ['Nam', 'Nữ'] as const;

export type ConfirmState = {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone: 'warning' | 'danger';
  onConfirm: () => void;
} | null;

let setGlobalConfirmState: ((s: ConfirmState) => void) | null = null;
export function registerConfirmSetter(fn: ((s: ConfirmState) => void) | null) {
  setGlobalConfirmState = fn;
}

export function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmText = 'Xác nhận',
  tone: 'warning' | 'danger' = 'danger',
) {
  if (setGlobalConfirmState) {
    setGlobalConfirmState({
      visible: true,
      title,
      description: message,
      confirmLabel: confirmText,
      tone,
      onConfirm,
    });
  } else {
    Alert.alert(title, message, [
      { text: 'Hủy', style: 'cancel' },
      { text: confirmText, style: 'destructive', onPress: onConfirm },
    ]);
  }
}

export function formatGender(g?: string | null) {
  if (g === 'MALE') return 'Nam';
  if (g === 'FEMALE') return 'Nữ';
  return '';
}

export function parseGenderLabel(label: string): string | null {
  if (label === 'Nam') return 'MALE';
  if (label === 'Nữ') return 'FEMALE';
  return null;
}

export function formatDob(iso?: string | null) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function parseDobInput(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (dmy) {
    const dd = dmy[1].padStart(2, '0');
    const mm = dmy[2].padStart(2, '0');
    return `${dmy[3]}-${mm}-${dd}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return null;
}

export function dishImageSource(url?: string | null, media?: Array<{ storageKey?: string; bucket?: string; publicUrl?: string }>): ImageSourcePropType {
  const normalized = normalizeImageUrl(url);
  if (normalized) return { uri: normalized };
  const primary = media?.[0];
  if (primary?.publicUrl) {
    const u = normalizeImageUrl(primary.publicUrl);
    if (u) return { uri: u };
  }
  if (primary?.storageKey) {
    const base = (
      process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://lkqvyvllmrbxgaoqrkhd.supabase.co'
    ).replace(/\/$/, '');
    if (base) {
      const bucket = primary.bucket ?? 'dish-images';
      return { uri: `${base}/storage/v1/object/public/${bucket}/${primary.storageKey}` };
    }
  }
  return dishPlaceholder;
}

export function formatPriceRange(min?: number | null, max?: number | null) {
  if (min == null && max == null) return null;
  const fmt = (n: number) => `${Math.round(n / 1000)}K`;
  if (min != null && max != null) return `${fmt(min)}–${fmt(max)}`;
  if (min != null) return `Từ ${fmt(min)}`;
  return `Đến ${fmt(max!)}`;
}

export function mealSlotLabel(slot?: string | null) {
  const s = (slot ?? '').toUpperCase();
  if (s === 'BREAKFAST') return 'Bữa sáng';
  if (s === 'LUNCH') return 'Bữa trưa';
  if (s === 'DINNER') return 'Bữa tối';
  if (s === 'SNACK') return 'Bữa phụ';
  return slot || 'Bữa ăn';
}

export function activityLabel(code?: string | null) {
  const c = (code ?? '').toUpperCase();
  if (c === 'SEDENTARY' || c === 'LOW') return 'Ít vận động';
  if (c === 'MODERATE' || c === 'MEDIUM') return 'Vừa phải';
  if (c === 'ACTIVE' || c === 'HIGH' || c === 'VERY_ACTIVE') return 'Năng động';
  return code || '—';
}

export function formatRelTime(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

export type Page =
  | 'main'
  | 'settings'
  | 'edit'
  | 'journey'
  | 'health'
  | 'preferences'
  | 'avoid'
  | 'saved'
  | 'privacy'
  | 'history'
  | 'posts'
  | 'followers'
  | 'following'
  | 'diary';
export type Props = {
  onHome: () => void;
  onExplore: () => void;
  onRandom: () => void;
  onHealth: () => void;
  onNotification?: () => void;
  onLoggedOut?: () => void;
  onDishDetail?: (dishId: string, title?: string) => void;
  onOpenPost?: (postId: string) => void;
  onOpenProfile?: (userId: string) => void;
};

export function LoadBlock({
  loading,
  error,
  onRetry,
  empty,
  emptyText,
  emptyEmoji = '🍃',
  skeleton = 'form',
  children,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  empty?: boolean;
  emptyText?: string;
  emptyEmoji?: string;
  skeleton?: 'edit' | 'form' | 'list' | 'journey' | 'history' | 'saved';
  children: ReactNode;
}) {
  if (loading) {
    if (skeleton === 'edit') return <ProfileEditSkeleton />;
    if (skeleton === 'history') return <RandomHistorySkeleton />;
    if (skeleton === 'saved') return <FoodListSkeleton count={5} />;
    if (skeleton === 'list') return <ListSkeleton rows={5} padded={false} />;
    if (skeleton === 'journey') return <JourneySkeleton />;
    return <FormRowsSkeleton rows={5} />;
  }
  if (error) {
  return (
      <PCard>
        <EmptyBlock
          emoji="😵"
          title="Không tải được"
          body={error}
          action={<PButton text="Thử lại" onPress={onRetry} variant="dark" />}
        />
      </PCard>
    );
  }
  if (empty) {
  return (
      <PCard>
        <EmptyBlock emoji={emptyEmoji} title={emptyText ?? 'Chưa có dữ liệu'} />
      </PCard>
    );
  }
  return <>{children}</>;
}

// ─── Shared list primitives ──────────────────────────────────────────────────

export function FoodRow({
  image,
  name,
  meta,
  chips,
  badge,
  onPress,
  trailing,
}: {
  image: ImageSourcePropType;
  name: string;
  meta?: string;
  chips?: string[];
  badge?: { text: string; variant?: 'success' | 'muted' | 'warning' };
  onPress?: () => void;
  /** Replaces the default chevron (e.g. an unsave button). */
  trailing?: ReactNode;
}) {
  const badgeBg = badge?.variant === 'success' ? P.successSoft : badge?.variant === 'warning' ? '#FFF8E1' : '#F3EDE2';
  const badgeFg = badge?.variant === 'success' ? P.success : badge?.variant === 'warning' ? '#B78103' : P.muted;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`Xem chi tiết món ${name}`}
      style={({ pressed }) => [fr.row, pressed && { transform: [{ scale: 0.985 }], opacity: 0.95 }]}
    >
      <Image source={image} style={fr.img} resizeMode="cover" />
      <View style={{ flex: 1, justifyContent: 'center', gap: 5 }}>
        <Text numberOfLines={2} style={fr.name}>
          {name}
        </Text>
        {chips && chips.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {chips.map((c) => (
              <View key={c} style={fr.chip}>
                <Text style={fr.chipTxt}>{c}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {badge || meta ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {badge ? (
              <View style={[fr.badge, { backgroundColor: badgeBg }]}>
                {badge.variant === 'success' ? <Check size={11} color={badgeFg} strokeWidth={3} /> : null}
                <Text style={[fr.badgeTxt, { color: badgeFg }]}>{badge.text}</Text>
              </View>
            ) : null}
            {meta ? (
              <Text numberOfLines={1} style={fr.meta}>
                {meta}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      {trailing ?? (onPress ? <ChevronRight size={18} color={P.faint} /> : null)}
    </Pressable>
  );
}

const fr = StyleSheet.create({
  row: {
    backgroundColor: P.card,
    borderRadius: 20,
    padding: 10,
    paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#5D490F',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  img: { width: 84, height: 84, borderRadius: 16, backgroundColor: '#F5EEDB' },
  name: { fontSize: 15.5, fontWeight: '800', color: P.ink, lineHeight: 20 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: '#FBF6EC' },
  chipTxt: { fontSize: 11.5, fontWeight: '700', color: P.ink2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeTxt: { fontSize: 11.5, fontWeight: '800' },
  meta: { fontSize: 12.5, color: P.muted },
});

export function MonthCalendar({ month, days }: { month: string; days: Array<{ localDate: string; status: string }> }) {
  const [y, m] = month.split('-').map(Number);
  const valid = Number.isFinite(y) && Number.isFinite(m);
  const label = valid ? `Tháng ${m}, ${y}` : month;
  const dayMap = new Map(days.map((d) => [d.localDate, d.status]));
  const daysInMonth = valid ? new Date(y, m, 0).getDate() : 31;
  // Monday-first offset
  const firstDow = valid ? (new Date(y, m - 1, 1).getDay() + 6) % 7 : 0;
  const todayIso = getTodayISO(getDeviceTimeZone());
  const cells: Array<number | null> = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const doneCount = days.filter((d) => isDoneStatus(d.status)).length;

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ fontSize: 17, fontWeight: '800', color: P.ink }}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: P.accent }} />
          <Text style={{ fontSize: 12.5, color: P.muted, fontWeight: '600' }}>{doneCount} ngày có bữa</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => (
          <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 11.5, fontWeight: '800', color: P.faint }}>
            {d}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 }}>
        {cells.map((d, i) => {
          if (d === null) return <View key={`e${i}`} style={{ width: `${100 / 7}%` }} />;
          const iso = `${month}-${String(d).padStart(2, '0')}`;
          const status = dayMap.get(iso) ?? 'EMPTY';
          const done = isDoneStatus(status);
          const partial = status === 'IN_PROGRESS';
          const isToday = iso === todayIso;
          const future = iso > todayIso;
          return (
            <View key={d} style={{ width: `${100 / 7}%`, alignItems: 'center' }}>
              <View
                style={[
                  cal.cell,
                  done && !partial && cal.cellDone,
                  partial && cal.cellPartial,
                  isToday && cal.cellToday,
                ]}
              >
                <Text style={[cal.cellTxt, done && { color: P.ink, fontWeight: '800' }, future && { color: P.faint }]}>{d}</Text>
                {done && !partial ? <Text style={{ fontSize: 8, marginTop: -1 }}>🍽️</Text> : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function isDoneStatus(status: string) {
  return status === 'QUALIFIED' || status === 'COMPLETED' || status === 'IN_PROGRESS';
}

const cal = StyleSheet.create({
  cell: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#FBF6EC', alignItems: 'center', justifyContent: 'center' },
  cellDone: { backgroundColor: P.accent },
  cellPartial: { backgroundColor: '#FFE9A8' },
  cellToday: { borderWidth: 2, borderColor: P.ink },
  cellTxt: { fontSize: 13, fontWeight: '600', color: P.ink2 },
});


export { isDoneStatus };
