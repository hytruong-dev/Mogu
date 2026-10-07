/**
 * Shared design primitives for the Profile area (main + every sub-page).
 *
 * Everything here is plain `StyleSheet` — no NativeWind `className` — so the
 * layout renders identically in dev and in the release APK.
 */
import { useEffect, type ComponentType, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  FadeInDown,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Check, ChevronRight, Search, X } from '@/components/icons';
import { Switch } from '../../components/ui/switch';
import { StyledPressable as Pressable } from '../../components/ui/styled-pressable';

// ─── Tokens ──────────────────────────────────────────────────────────────────

export const P = {
  bg: '#FFF8EC',
  card: '#FFFFFF',
  ink: '#2A1A10',
  ink2: '#5A4A3F',
  muted: '#7E6E65',
  faint: '#C4B8A8',
  line: '#F0E6D2',
  accent: '#FFC928',
  accentDeep: '#B26A00',
  accentSoft: '#FFF3C7',
  danger: '#E5402A',
  dangerSoft: '#FFEDEA',
  success: '#16A34A',
  successSoft: '#E3F8EA',
  info: '#3B82F6',
  infoSoft: '#E3EEFF',
} as const;

export const TINTS = {
  yellow: { color: '#B26A00', bg: '#FFF3C7' },
  orange: { color: '#E85E2F', bg: '#FDEEE9' },
  green: { color: '#16A34A', bg: '#E3F8EA' },
  blue: { color: '#3B82F6', bg: '#E3EEFF' },
  purple: { color: '#8B5CF6', bg: '#EFEAFE' },
  red: { color: '#E5402A', bg: '#FFEDEA' },
  gray: { color: '#6B5A4A', bg: '#F3EDE2' },
} as const;
export type Tint = keyof typeof TINTS;

const shadow = {
  shadowColor: '#5D490F',
  shadowOpacity: 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 5 },
  elevation: 3,
} as const;

// ─── Layout ──────────────────────────────────────────────────────────────────

export function SubHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  right?: ReactNode;
}) {
  return (
    <View style={s.header}>
      <Pressable
        onPress={onBack}
        hitSlop={8}
        accessibilityLabel="Quay lại"
        style={({ pressed }) => [s.backBtn, pressed && { transform: [{ scale: 0.92 }] }]}
      >
        <ArrowLeft size={21} color={P.ink} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={s.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={s.headerSub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? <View style={{ width: 40 }} />}
    </View>
  );
}

/** Scrollable page body with an optional sticky footer (save button, etc.). */
export function PageScaffold({
  children,
  footer,
  gap = 14,
  padded = true,
  onEndReached,
}: {
  children: ReactNode;
  footer?: ReactNode;
  gap?: number;
  padded?: boolean;
  /** Called when the user scrolls near the bottom (infinite scroll). */
  onEndReached?: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: padded ? 18 : 0,
          paddingTop: 6,
          paddingBottom: footer ? 24 : Math.max(28, insets.bottom + 16),
          gap,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={64}
        onScroll={
          onEndReached
            ? (e) => {
                const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
                if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 320) onEndReached();
              }
            : undefined
        }
      >
        {children}
      </ScrollView>
      {footer ? (
        <View style={[s.footer, { paddingBottom: Math.max(14, insets.bottom + 8) }]}>{footer}</View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

export function PCard({
  children,
  style,
  noPadding,
  delay,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  noPadding?: boolean;
  delay?: number;
}) {
  const content = <View style={[s.card, noPadding && { padding: 0 }, style]}>{children}</View>;
  if (delay === undefined) return content;
  return <Animated.View entering={FadeInDown.delay(delay).duration(360)}>{content}</Animated.View>;
}

export function SectionTitle({
  title,
  sub,
  action,
  onAction,
  style,
}: {
  title: string;
  sub?: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.sectionHead, style]}>
      <View style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>{title}</Text>
        {sub ? <Text style={s.sectionSub}>{sub}</Text> : null}
      </View>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8} style={s.linkBtn}>
          <Text style={s.linkTxt}>{action}</Text>
          <ChevronRight size={15} color={P.accentDeep} />
        </Pressable>
      ) : null}
    </View>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────────

export function IconBox({
  icon: Icon,
  tint = 'yellow',
  size = 42,
  iconSize,
}: {
  icon: ComponentType<any>;
  tint?: Tint;
  size?: number;
  iconSize?: number;
}) {
  const t = TINTS[tint];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.32),
        backgroundColor: t.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon size={iconSize ?? Math.round(size * 0.5)} color={t.color} strokeWidth={2.1} />
    </View>
  );
}

// ─── Rows ────────────────────────────────────────────────────────────────────

export function PRow({
  icon,
  tint = 'yellow',
  title,
  sub,
  value,
  onPress,
  last,
  danger,
  right,
}: {
  icon: ComponentType<any>;
  tint?: Tint;
  title: string;
  sub?: string;
  /** Short value shown at the right (e.g. "Sáng"). */
  value?: string;
  onPress?: () => void;
  last?: boolean;
  danger?: boolean;
  right?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [s.row, !last && s.rowDivider, pressed && onPress ? s.rowPressed : null]}
    >
      <IconBox icon={icon} tint={danger ? 'red' : tint} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.rowTitle, danger && { color: P.danger }]} numberOfLines={1}>
          {title}
        </Text>
        {sub ? (
          <Text style={s.rowSub} numberOfLines={2}>
            {sub}
          </Text>
        ) : null}
      </View>
      {right ??
        (value ? <Text style={s.rowValue}>{value}</Text> : null) ??
        null}
      {onPress && !right ? <ChevronRight size={18} color={P.faint} /> : null}
    </Pressable>
  );
}

export function PToggleRow({
  icon,
  tint = 'yellow',
  title,
  sub,
  value,
  onChange,
  disabled,
  last,
}: {
  icon: ComponentType<any>;
  tint?: Tint;
  title: string;
  sub?: string;
  value: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[s.row, !last && s.rowDivider, disabled && { opacity: 0.55 }]}>
      <IconBox icon={icon} tint={tint} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {sub ? (
          <Text style={s.rowSub} numberOfLines={2}>
            {sub}
          </Text>
        ) : null}
      </View>
      <Switch checked={value} disabled={disabled} onCheckedChange={(v) => onChange?.(v)} />
    </View>
  );
}

// ─── Buttons & chips ─────────────────────────────────────────────────────────

export function PButton({
  text,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  icon: Icon,
}: {
  text: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'dark' | 'danger' | 'ghost';
  icon?: ComponentType<any>;
}) {
  const off = disabled || loading;
  const fg =
    variant === 'primary' ? P.ink : variant === 'dark' ? '#FFFFFF' : variant === 'danger' ? P.danger : P.ink;
  const body = (
    <>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {Icon ? <Icon size={18} color={fg} /> : null}
          <Text style={[s.btnTxt, { color: fg }]}>{text}</Text>
        </>
      )}
    </>
  );
  return (
    <Pressable
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        variant === 'dark' && { backgroundColor: P.ink },
        variant === 'danger' && { backgroundColor: P.dangerSoft },
        variant === 'ghost' && { backgroundColor: 'transparent' },
        off && { opacity: 0.55 },
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={['#FFD54F', '#FFC107']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 18 }]}
        />
      ) : null}
      {body}
    </Pressable>
  );
}

export function PChip({
  text,
  active,
  onPress,
  tint = 'yellow',
  check,
}: {
  text: string;
  active?: boolean;
  onPress?: () => void;
  tint?: Tint;
  /** Show a check icon when active. */
  check?: boolean;
}) {
  const t = TINTS[tint];
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => [
        s.chip,
        active && { backgroundColor: P.ink, borderColor: P.ink },
        pressed && { transform: [{ scale: 0.96 }] },
      ]}
    >
      {check && active ? <Check size={14} color={P.accent} strokeWidth={3} /> : null}
      <Text style={[s.chipTxt, active && { color: '#FFFFFF' }]}>{text}</Text>
    </Pressable>
  );
}

export function PTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ key: T; label: string; count?: number }>;
  value: T;
  onChange: (k: T) => void;
}) {
  return (
    <View style={s.tabs}>
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={[s.tab, active && s.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[s.tabTxt, active && s.tabTxtActive]}>{t.label}</Text>
            {t.count !== undefined ? (
              <View style={[s.tabCount, active && { backgroundColor: P.accent }]}>
                <Text style={[s.tabCountTxt, active && { color: P.ink }]}>{t.count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Inputs ──────────────────────────────────────────────────────────────────

export function PSearchBar({
  value,
  onChangeText,
  placeholder,
  onSubmit,
  right,
  autoFocus,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  right?: ReactNode;
  autoFocus?: boolean;
}) {
  return (
    <View style={s.search}>
      <Search size={19} color={P.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={P.faint}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        autoFocus={autoFocus}
        style={s.searchInput}
      />
      {right ??
        (value ? (
          <Pressable onPress={() => onChangeText('')} hitSlop={8} accessibilityLabel="Xoá tìm kiếm">
            <X size={17} color={P.muted} />
          </Pressable>
        ) : null)}
    </View>
  );
}

/** Labelled field card: icon + small label + any input/select content. */
export function PField({
  label,
  icon,
  tint = 'yellow',
  children,
  hint,
  locked,
}: {
  label: string;
  icon: ComponentType<any>;
  tint?: Tint;
  children: ReactNode;
  hint?: string;
  locked?: boolean;
}) {
  return (
    <View style={[s.field, locked && { backgroundColor: '#FBF6EC' }]}>
      <IconBox icon={icon} tint={locked ? 'gray' : tint} size={38} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.fieldLabel}>{label}</Text>
        {children}
        {hint ? <Text style={s.fieldHint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

export function PInput(props: TextInputProps & { big?: boolean }) {
  const { big, style, ...rest } = props;
  return (
    <TextInput
      placeholderTextColor={P.faint}
      {...rest}
      style={[s.input, big && s.inputBig, rest.editable === false && { color: P.muted }, style]}
    />
  );
}

// ─── Data display ────────────────────────────────────────────────────────────

export function StatTile({
  label,
  value,
  unit,
  emoji,
  icon: Icon,
  tint = 'yellow',
  style,
}: {
  label: string;
  value: string | number;
  unit?: string;
  emoji?: string;
  icon?: ComponentType<any>;
  tint?: Tint;
  style?: StyleProp<ViewStyle>;
}) {
  const t = TINTS[tint];
  return (
    <View style={[s.tile, { backgroundColor: t.bg }, style]}>
      {emoji ? <Text style={{ fontSize: 20 }}>{emoji}</Text> : Icon ? <Icon size={20} color={t.color} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginTop: 6 }}>
        <Text style={s.tileValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {value}
        </Text>
        {unit ? <Text style={s.tileUnit}>{unit}</Text> : null}
      </View>
      <Text style={s.tileLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function ProgressBar({ pct, color = P.accent, height = 10 }: { pct: number; color?: string; height?: number }) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(Math.max(0, Math.min(100, pct)), { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [pct, w]);
  const st = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: '#F3EDE2', overflow: 'hidden' }}>
      <Animated.View style={[{ height: '100%', borderRadius: height / 2, backgroundColor: color }, st]} />
    </View>
  );
}

export function InlineNotice({ tone, text }: { tone: 'success' | 'error' | 'info'; text: string }) {
  const bg = tone === 'success' ? P.successSoft : tone === 'error' ? P.dangerSoft : P.infoSoft;
  const fg = tone === 'success' ? P.success : tone === 'error' ? P.danger : P.info;
  return (
    <Animated.View entering={FadeInDown.duration(260)} style={[s.notice, { backgroundColor: bg }]}>
      <Text style={[s.noticeTxt, { color: fg }]}>{text}</Text>
    </Animated.View>
  );
}

export function InfoBanner({
  emoji = '💡',
  title,
  body,
  tint = 'yellow',
}: {
  emoji?: string;
  title?: string;
  body: string;
  tint?: Tint;
}) {
  const t = TINTS[tint];
  return (
    <View style={[s.banner, { backgroundColor: t.bg }]}>
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        {title ? <Text style={[s.bannerTitle, { color: t.color }]}>{title}</Text> : null}
        <Text style={s.bannerBody}>{body}</Text>
      </View>
    </View>
  );
}

export function EmptyBlock({
  emoji,
  title,
  body,
  action,
}: {
  emoji: string;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  const bob = useSharedValue(0);
  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(bob);
  }, [bob]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }] }));
  return (
    <View style={s.empty}>
      <Animated.View style={[s.emptyEmoji, st]}>
        <Text style={{ fontSize: 34 }}>{emoji}</Text>
      </Animated.View>
      <Text style={s.emptyTitle}>{title}</Text>
      {body ? <Text style={s.emptyBody}>{body}</Text> : null}
      {action ? <View style={{ marginTop: 14 }}>{action}</View> : null}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: P.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8A6A2A',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: P.ink, letterSpacing: -0.3 },
  headerSub: { fontSize: 12.5, color: P.muted, marginTop: 1 },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 10,
    backgroundColor: P.bg,
    borderTopWidth: 1,
    borderTopColor: P.line,
  },
  card: { backgroundColor: P.card, borderRadius: 20, padding: 16, ...shadow },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 4, marginBottom: -4 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: P.ink },
  sectionSub: { fontSize: 12.5, color: P.muted, marginTop: 2 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingBottom: 1 },
  linkTxt: { fontSize: 13.5, fontWeight: '700', color: P.accentDeep },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: '#F6EFE2' },
  rowPressed: { backgroundColor: '#FFFBF2' },
  rowTitle: { fontSize: 15.5, fontWeight: '700', color: P.ink },
  rowSub: { fontSize: 13, color: P.muted, marginTop: 2, lineHeight: 17 },
  rowValue: { fontSize: 13.5, fontWeight: '600', color: P.muted },
  btn: {
    height: 52,
    borderRadius: 18,
    backgroundColor: P.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    overflow: 'hidden',
  },
  btnTxt: { fontSize: 16, fontWeight: '800', letterSpacing: 0.1 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    backgroundColor: P.card,
    borderWidth: 1,
    borderColor: P.line,
  },
  chipTxt: { fontSize: 14, fontWeight: '700', color: P.ink2 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: P.card,
    borderWidth: 1,
    borderColor: P.line,
  },
  tabActive: { backgroundColor: P.ink, borderColor: P.ink },
  tabTxt: { fontSize: 13.5, fontWeight: '700', color: P.muted },
  tabTxtActive: { color: '#FFFFFF' },
  tabCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: '#F3EDE2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCountTxt: { fontSize: 11, fontWeight: '800', color: P.muted },
  search: {
    height: 50,
    borderRadius: 16,
    backgroundColor: P.card,
    borderWidth: 1,
    borderColor: P.line,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: P.ink, paddingVertical: 0 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: P.card,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 64,
    ...shadow,
    shadowOpacity: 0.05,
  },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: P.muted, letterSpacing: 0.2 },
  fieldHint: { fontSize: 11.5, color: P.faint, marginTop: 2 },
  input: { fontSize: 15.5, fontWeight: '600', color: P.ink, paddingVertical: 2, paddingHorizontal: 0, minHeight: 26 },
  inputBig: { fontSize: 30, fontWeight: '800', minHeight: 40 },
  tile: { flex: 1, borderRadius: 18, padding: 14, minHeight: 104, justifyContent: 'flex-end' },
  tileValue: { fontSize: 24, fontWeight: '800', color: P.ink, letterSpacing: -0.4 },
  tileUnit: { fontSize: 13, fontWeight: '700', color: P.muted, marginBottom: 3 },
  tileLabel: { fontSize: 12.5, color: P.muted, marginTop: 2 },
  notice: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11 },
  noticeTxt: { fontSize: 13.5, fontWeight: '600', textAlign: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 14 },
  bannerTitle: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  bannerBody: { fontSize: 13.5, color: P.ink2, lineHeight: 19 },
  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24 },
  emptyEmoji: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: P.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: P.ink, marginTop: 14 },
  emptyBody: { fontSize: 13.5, color: P.muted, textAlign: 'center', marginTop: 4, lineHeight: 19 },
});
