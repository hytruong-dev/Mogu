/**
 * NOAN Health — shared tokens & primitives (redesign 29/09/2026).
 * Nền kem #FFFAF0, card trắng, chữ nâu #48210B, CTA vàng #FFC928.
 * Dùng StyleSheet để hiển thị đồng nhất iOS/Android.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  ArrowLeft,
  Beef,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Droplet,
  Info,
  Moon,
  Sun,
  Utensils,
  Wheat,
} from '@/components/icons';
import { AppImage } from '../../components/ui/app-image';
// react-native-reusables
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text as UIText } from '@/components/ui/text';
import { cn } from '@/lib/utils';

// ─── Tokens ──────────────────────────────────────────────────────────────────

export const HC = {
  bg: '#FFFAF0',
  card: '#FFFFFF',
  ink: '#48210B',
  sub: '#8A6F5C',
  muted: '#B9A898',
  line: '#F1E6D3',
  chip: '#F6EFE3',
  yellow: '#FFC928',
  yellowDeep: '#E6AC00',
  yellowSoft: '#FFF3C4',
  track: '#F2EBDD',
  skeleton: '#EFE9DE',
  protein: '#E0685F',
  proteinBg: '#FDEBE8',
  carbs: '#E4A63A',
  carbsBg: '#FFF4DA',
  fat: '#F0B429',
  fatBg: '#FFF6D9',
  moon: '#7C83D8',
  moonBg: '#EEEFFB',
  snack: '#8C6FD1',
  snackBg: '#F1ECFB',
};

export const cardShadow: ViewStyle = {
  shadowColor: '#6B4A1A',
  shadowOpacity: 0.06,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};

/** Chừa đáy cho LiquidGlassBottomNav (bottom 12 + height 92). */
export const NAV_CLEARANCE = 112;

// ─── Formatting ──────────────────────────────────────────────────────────────

export function fmtNum(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const r = Math.round(n);
  const s = String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return r < 0 ? `-${s}` : s;
}

export function fmtKcal(n: number | null | undefined): string {
  return n == null ? '—' : `${fmtNum(n)} kcal`;
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** "Hôm nay, 29 tháng 9" hoặc "29 tháng 9, 2026". */
export function formatDayLabel(date: Date, withYear = false) {
  const base = `${date.getDate()} tháng ${date.getMonth() + 1}`;
  if (isSameDay(date, new Date())) return `Hôm nay, ${base}${withYear ? `, ${date.getFullYear()}` : ''}`;
  return `${base}, ${date.getFullYear()}`;
}

export function formatTime(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function toLocalDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

const WEEKDAY_FULL = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
export function weekdayFull(iso: string) {
  return WEEKDAY_FULL[parseISODate(iso).getDay()] ?? '';
}

// ─── Meal slots & macros ─────────────────────────────────────────────────────

export type MealSlot = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
export const MEAL_SLOTS: MealSlot[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];
export const SLOT_LABEL: Record<string, string> = {
  BREAKFAST: 'Bữa sáng',
  LUNCH: 'Bữa trưa',
  DINNER: 'Bữa tối',
  SNACK: 'Bữa phụ',
};
export const SLOT_SHORT: Record<string, string> = {
  BREAKFAST: 'Sáng',
  LUNCH: 'Trưa',
  DINNER: 'Tối',
  SNACK: 'Bữa phụ',
};

export function SlotIcon({ slot, size = 20 }: { slot: string; size?: number }) {
  if (slot === 'DINNER') return <Moon size={size} color={HC.moon} fill={HC.moonBg} />;
  if (slot === 'SNACK') return <Coffee size={size} color={HC.snack} />;
  return <Sun size={size} color={HC.carbs} />;
}

export type MacroKey = 'protein' | 'carbs' | 'fat';
export const MACROS: Array<{ key: MacroKey; label: string; color: string; bg: string }> = [
  { key: 'protein', label: 'Đạm', color: HC.protein, bg: HC.proteinBg },
  { key: 'carbs', label: 'Tinh bột', color: HC.carbs, bg: HC.carbsBg },
  { key: 'fat', label: 'Chất béo', color: HC.fat, bg: HC.fatBg },
];

export function MacroIcon({ kind, size = 18 }: { kind: MacroKey; size?: number }) {
  if (kind === 'protein') return <Beef size={size} color={HC.protein} />;
  if (kind === 'carbs') return <Wheat size={size} color={HC.carbs} />;
  return <Droplet size={size} color={HC.fat} fill={HC.fat} />;
}

export function MacroBadge({ kind, size = 44 }: { kind: MacroKey; size?: number }) {
  const meta = MACROS.find((m) => m.key === kind)!;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: meta.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <MacroIcon kind={kind} size={size * 0.48} />
    </View>
  );
}

// ─── Layout primitives ───────────────────────────────────────────────────────

/**
 * LƯU Ý ANDROID: NativeWind css-interop bỏ qua `style={({ pressed }) => …}` trên Pressable
 * → card/nút mất toàn bộ nền, padding, flexDirection. Chỉ dùng style tĩnh + className `active:`.
 */
const OUTER_KEYS = [
  'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf', 'width', 'minWidth', 'maxWidth',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical',
  'position', 'top', 'left', 'right', 'bottom',
] as const;

/** Tách style bố cục (cho Pressable bên ngoài) khỏi style hiển thị (cho Card bên trong). */
function splitStyle(style?: StyleProp<ViewStyle>) {
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(flat)) {
    ((OUTER_KEYS as readonly string[]).includes(k) ? outer : inner)[k] = v;
  }
  if (outer.flex != null) inner.flex = 1;
  return { outer: outer as ViewStyle, inner: inner as ViewStyle };
}

/** Card của react-native-reusables với token NOAN (radius 22, padding 16, viền kem). */
const CARD_CLASS = 'gap-0 rounded-[22px] border-[#F5EDE0] bg-card p-4 py-4 shadow-none';

export function HCard({
  children,
  style,
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  if (onPress) {
    const { outer, inner } = splitStyle(style);
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        className="active:opacity-80"
        style={outer}
      >
        <Card className={CARD_CLASS} style={[cardShadow, inner]}>
          {children}
        </Card>
      </Pressable>
    );
  }
  return (
    <Card className={CARD_CLASS} style={[cardShadow, style]}>
      {children}
    </Card>
  );
}

export function SectionTitle({
  children,
  right,
  style,
}: {
  children: ReactNode;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.sectionRow, style]}>
      <Text style={s.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function SubHeader({
  title,
  onBack,
  align = 'center',
  right,
  chevron = false,
}: {
  title: string;
  onBack: () => void;
  align?: 'center' | 'left';
  right?: ReactNode;
  /** Dùng mũi tên "<" như design màn Tổng quan. */
  chevron?: boolean;
}) {
  return (
    <View style={s.subHeader}>
      <Pressable
        onPress={onBack}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Quay lại"
        style={s.iconBtn}
      >
        {chevron ? <ChevronLeft size={26} color={HC.ink} /> : <ArrowLeft size={24} color={HC.ink} />}
      </Pressable>
      <Text
        numberOfLines={1}
        style={[s.subHeaderTitle, align === 'center' ? s.subHeaderCenter : s.subHeaderLeft]}
      >
        {title}
      </Text>
      <View style={s.iconBtn}>{right}</View>
    </View>
  );
}

export function DatePill({
  label,
  onPrev,
  onNext,
  onPress,
  showIcon = true,
  style,
}: {
  label: string;
  onPrev?: () => void;
  onNext?: () => void;
  onPress?: () => void;
  showIcon?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.datePill, style]}>
      <Pressable
        onPress={onPrev}
        disabled={!onPrev}
        hitSlop={6}
        accessibilityLabel="Kỳ trước"
        style={[s.dateChevron, !onPrev && { opacity: 0 }]}
      >
        <ChevronLeft size={20} color={HC.ink} />
      </Pressable>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole="button"
        accessibilityLabel={`Chọn ngày, ${label}`}
        style={s.dateCenter}
      >
        {showIcon ? <CalendarDays size={18} color={HC.ink} /> : null}
        <Text numberOfLines={1} style={s.dateText}>
          {label}
        </Text>
      </Pressable>
      <Pressable
        onPress={onNext}
        disabled={!onNext}
        hitSlop={6}
        accessibilityLabel="Kỳ sau"
        style={[s.dateChevron, !onNext && { opacity: 0 }]}
      >
        <ChevronRight size={20} color={HC.ink} />
      </Pressable>
    </View>
  );
}

export function PrimaryButton({
  label,
  icon,
  onPress,
  disabled,
  loading,
  style,
}: {
  label: string;
  icon?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const off = disabled || loading;
  return (
    <Button
      onPress={onPress}
      disabled={off}
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      className={cn(
        'h-14 w-full flex-row gap-2 rounded-full px-6',
        off ? 'bg-[#ECE6DC] opacity-100' : 'bg-primary active:bg-[#E6AC00]',
      )}
      style={[off ? null : s.primaryShadow, style]}
    >
      {loading ? <ActivityIndicator size="small" color={HC.sub} /> : icon}
      <UIText className={cn('text-[17px] font-extrabold', off ? 'text-[#B9A898]' : 'text-[#48210B]')}>{label}</UIText>
    </Button>
  );
}

export function OutlineButton({
  label,
  onPress,
  style,
}: {
  label: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Button
      variant="outline"
      onPress={onPress}
      accessibilityLabel={label}
      className="h-[52px] w-full rounded-full border-[1.5px] border-primary bg-card shadow-none active:bg-[#FFF3C4]"
      style={style}
    >
      <UIText className="text-base font-extrabold text-[#48210B]">{label}</UIText>
    </Button>
  );
}

export function ProgressBar({
  value,
  color = HC.yellow,
  height = 10,
  style,
}: {
  value: number;
  color?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={style}>
      <Progress
        value={pct}
        className="w-full rounded-full bg-[#F2EBDD]"
        indicatorClassName="rounded-full"
        style={{ height }}
        indicatorStyle={{ backgroundColor: color }}
      />
    </View>
  );
}

export function InfoNote({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.info, style]}>
      <Info size={16} color={HC.sub} />
      <Text style={s.infoText}>{children}</Text>
    </View>
  );
}

// ─── Media ───────────────────────────────────────────────────────────────────

export function Thumb({
  uri,
  width = 56,
  height,
  radius = 12,
}: {
  uri?: string | null;
  width?: number;
  height?: number;
  radius?: number;
}) {
  const h = height ?? width;
  return (
    <AppImage
      uri={uri}
      style={{ width, height: h, borderRadius: radius }}
      borderRadius={radius}
      showLoader={false}
      fallbackIcon={<Utensils size={Math.min(width, h) * 0.4} color={HC.muted} />}
    />
  );
}

export function EmptyThumb({ size = 40 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        borderWidth: 1.2,
        borderStyle: 'dashed',
        borderColor: HC.muted,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Utensils size={size * 0.42} color={HC.muted} />
    </View>
  );
}

export function ThumbRow({ urls, max = 3, size = 40 }: { urls: string[]; max?: number; size?: number }) {
  const list = urls.filter(Boolean).slice(0, max);
  if (list.length === 0) return <EmptyThumb size={size} />;
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {list.map((u, i) => (
        <Thumb key={`${u}-${i}`} uri={u} width={size} radius={10} />
      ))}
    </View>
  );
}

// ─── Segmented ───────────────────────────────────────────────────────────────

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: Array<{ id: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as T)} style={style} className="gap-0">
      <TabsList className="mr-0 h-12 w-full rounded-full bg-[#F6EFE3] p-1">
        {options.map((o) => {
          const active = o.id === value;
          return (
            <TabsTrigger
              key={o.id}
              value={o.id}
              className={cn('h-10 flex-1 rounded-full border-0', active ? 'bg-primary' : 'bg-transparent')}
            >
              <UIText className={cn('text-[15px]', active ? 'font-extrabold text-[#48210B]' : 'font-semibold text-[#8A6F5C]')}>
                {o.label}
              </UIText>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}

// ─── Bar chart ───────────────────────────────────────────────────────────────

export type BarDatum = {
  key: string;
  label: string;
  subLabel?: string;
  value: number | null;
};

function niceStep(raw: number) {
  if (raw <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 3 ? 3 : n <= 5 ? 5 : 10;
  return nice * pow;
}

export function BarChart({
  data,
  height = 140,
  showValues = false,
  yAxis = false,
  unitLabel,
  emptyStyle = 'dashed',
  barWidth = 26,
  onPressItem,
}: {
  data: BarDatum[];
  height?: number;
  showValues?: boolean;
  yAxis?: boolean;
  unitLabel?: string;
  emptyStyle?: 'dashed' | 'dash';
  barWidth?: number;
  onPressItem?: (d: BarDatum) => void;
}) {
  const maxRaw = Math.max(0, ...data.map((d) => d.value ?? 0));
  const step = niceStep((maxRaw || 1) / 4);
  const top = yAxis ? step * 4 : Math.max(maxRaw, 1);
  const ticks = yAxis ? [4, 3, 2, 1, 0].map((i) => i * step) : [];
  const valueSpace = showValues ? 18 : 0;
  const plotH = height - valueSpace;

  return (
    <View>
      {yAxis && unitLabel ? <Text style={s.axisUnit}>{unitLabel}</Text> : null}
      <View style={{ flexDirection: 'row' }}>
        {yAxis ? (
          <View style={{ width: 40, height, justifyContent: 'space-between', paddingTop: valueSpace }}>
            {ticks.map((t) => (
              <Text key={t} style={[s.axisText, { marginTop: t === ticks[0] ? -7 : 0, marginBottom: t === 0 ? -7 : 0 }]}>
                {fmtNum(t)}
              </Text>
            ))}
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <View style={{ height, justifyContent: 'flex-end' }}>
            {yAxis ? (
              <View style={[StyleSheet.absoluteFill, { top: valueSpace, justifyContent: 'space-between' }]} pointerEvents="none">
                {ticks.map((t) => (
                  <View
                    key={t}
                    style={{
                      height: 1,
                      backgroundColor: t === 0 ? HC.line : 'transparent',
                      borderTopWidth: t === 0 ? 0 : 1,
                      borderStyle: 'dashed',
                      borderColor: HC.line,
                    }}
                  />
                ))}
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height }}>
              {data.map((d) => {
                const has = d.value != null && d.value > 0;
                const h = has ? Math.max(6, ((d.value as number) / top) * plotH) : 0;
                return (
                  <Pressable
                    key={d.key}
                    disabled={!onPressItem}
                    onPress={() => onPressItem?.(d)}
                    accessibilityLabel={`${d.label}${d.subLabel ? ` ${d.subLabel}` : ''}: ${
                      has ? fmtNum(d.value) : 'chưa có nhật ký'
                    }`}
                    style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height }}
                  >
                    {showValues ? (
                      <Text numberOfLines={1} style={s.barValue}>
                        {has ? fmtNum(d.value) : '–'}
                      </Text>
                    ) : null}
                    {has ? (
                      <View
                        style={{
                          width: barWidth,
                          height: h,
                          borderTopLeftRadius: 6,
                          borderTopRightRadius: 6,
                          backgroundColor: HC.yellow,
                        }}
                      />
                    ) : emptyStyle === 'dashed' ? (
                      <View
                        style={{
                          width: barWidth,
                          height: Math.min(34, plotH * 0.3),
                          borderTopLeftRadius: 6,
                          borderTopRightRadius: 6,
                          borderWidth: 1.2,
                          borderBottomWidth: 0,
                          borderStyle: 'dashed',
                          borderColor: HC.muted,
                        }}
                      />
                    ) : (
                      <View style={{ width: 14, height: 2, borderRadius: 1, backgroundColor: HC.muted, marginBottom: 2 }} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: HC.line }} />
          <View style={{ flexDirection: 'row', marginTop: 6 }}>
            {data.map((d) => (
              <View key={d.key} style={{ flex: 1, alignItems: 'center' }}>
                <Text numberOfLines={1} style={s.barLabel}>
                  {d.label}
                </Text>
                {d.subLabel ? (
                  <Text numberOfLines={1} style={s.barSub}>
                    {d.subLabel}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

export function usePulse() {
  const v = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return v;
}

export function Bone({
  w,
  h,
  r = 8,
  style,
}: {
  w: number | `${number}%`;
  h: number;
  r?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <Skeleton className="bg-[#EFE9DE]" style={[{ width: w, height: h, borderRadius: r }, style]} />;
}

// ─── Row helpers ─────────────────────────────────────────────────────────────

export function ListRow({
  title,
  subtitle,
  right,
  left,
  onPress,
  muted,
  style,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  left?: ReactNode;
  onPress?: () => void;
  muted?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <HCard onPress={onPress} accessibilityLabel={`${title}${subtitle ? `, ${subtitle}` : ''}`} style={[s.listRow, style]}>
      {left}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[s.listTitle, muted && { color: HC.sub, fontWeight: '600' }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={[s.listSub, muted && { color: HC.muted }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress ? <ChevronRight size={20} color={HC.ink} /> : null}
    </HCard>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: HC.bg },
  pressed: { opacity: 0.88, transform: [{ scale: 0.995 }] },
  card: {
    backgroundColor: HC.card,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F5EDE0',
    ...cardShadow,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: HC.ink },
  subHeader: { height: 56, flexDirection: 'row', alignItems: 'center' },
  subHeaderTitle: { flex: 1, fontSize: 19, fontWeight: '800', color: HC.ink },
  subHeaderCenter: { textAlign: 'center' },
  subHeaderLeft: { textAlign: 'left', marginLeft: 4 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  datePill: {
    height: 48,
    borderRadius: 24,
    backgroundColor: HC.card,
    borderWidth: 1,
    borderColor: HC.line,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    ...cardShadow,
  },
  dateChevron: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dateCenter: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dateText: { fontSize: 15, fontWeight: '600', color: HC.ink, flexShrink: 1 },
  primary: {
    height: 56,
    borderRadius: 28,
    backgroundColor: HC.yellow,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#C79200',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  primaryDisabled: { backgroundColor: '#ECE6DC', shadowOpacity: 0, elevation: 0 },
  primaryShadow: {
    shadowColor: '#C79200',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  primaryText: { fontSize: 17, fontWeight: '800', color: HC.ink },
  outline: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: HC.yellow,
    backgroundColor: HC.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineText: { fontSize: 16, fontWeight: '800', color: HC.ink },
  info: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: HC.chip,
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 19, color: HC.sub },
  segment: {
    flexDirection: 'row',
    backgroundColor: HC.chip,
    borderRadius: 24,
    padding: 4,
  },
  segmentItem: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: HC.yellow },
  segmentText: { fontSize: 15, fontWeight: '600', color: HC.sub },
  segmentTextActive: { color: HC.ink, fontWeight: '800' },
  axisUnit: { fontSize: 11, color: HC.sub, marginBottom: 4 },
  axisText: { fontSize: 11, color: HC.sub, textAlign: 'right', paddingRight: 6 },
  barValue: { fontSize: 11, fontWeight: '700', color: HC.ink, marginBottom: 4 },
  barLabel: { fontSize: 12, fontWeight: '600', color: HC.ink },
  barSub: { fontSize: 10, color: HC.sub, marginTop: 1 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  listTitle: { fontSize: 15, fontWeight: '800', color: HC.ink },
  listSub: { fontSize: 13, color: HC.sub, marginTop: 2 },
});
