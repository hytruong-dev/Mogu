import { forwardRef, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import type { LucideProps } from '@/components/icons';
import { Check, Eye, EyeOff, TriangleAlert } from '@/components/icons';
import { StyledPressable } from '../../components/ui/styled-pressable';

/* ─── Tokens ───────────────────────────────────────────────────────────────── */
export const A = {
  bg: '#FFF8E7',
  bgTop: '#FFE89A',
  card: '#FFFFFF',
  ink: '#2A1C0C',
  sub: '#7A6852',
  hint: '#A99A84',
  line: '#F0E6D2',
  field: '#FBF6EA',
  fieldFocus: '#FFFFFF',
  brand: '#FFC928',
  brandDeep: '#F5A800',
  brandInk: '#3A2600',
  link: '#D98A00',
  danger: '#E5484D',
  dangerBg: '#FFF1F0',
  ok: '#2FA36B',
} as const;

const MASCOT = require('../../assets/images/noan/noan-mascot-master-v1.png');
const WORDMARK = require('../../assets/images/noan/noan-wordmark-custom-v2.png');

/* ─── Layout ───────────────────────────────────────────────────────────────── */
export function AuthScaffold({
  children,
  top,
  onDismissKeyboard,
}: {
  children: ReactNode;
  top?: ReactNode;
  onDismissKeyboard?: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={s.root}>
      <LinearGradient
        colors={[A.bgTop, '#FFF3C9', A.bg]}
        locations={[0, 0.35, 0.7]}
        style={StyleSheet.absoluteFill}
      />
      {/* Soft decorative blobs */}
      <View pointerEvents="none" style={[s.blob, { top: -80, right: -70, width: 220, height: 220, backgroundColor: 'rgba(255,201,40,0.28)' }]} />
      <View pointerEvents="none" style={[s.blob, { top: 140, left: -90, width: 180, height: 180, backgroundColor: 'rgba(255,170,60,0.14)' }]} />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {top}
        {/* On Android with adjustResize, behavior must be undefined to avoid double-resizing/jumping */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[s.scroll, { paddingBottom: Math.max(24, insets.bottom + 16) }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            onScrollBeginDrag={() => {
              onDismissKeyboard?.();
            }}
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/** Mascot with a glowing halo, gentle float and the NOAN wordmark. */
export function AuthHero({
  title,
  subtitle,
  size = 'lg',
  showWordmark = true,
}: {
  title: string;
  subtitle: string;
  size?: 'lg' | 'sm';
  showWordmark?: boolean;
}) {
  const m = size === 'lg' ? 132 : 96;
  const float = useSharedValue(0);
  useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(float);
  }, [float]);
  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -6 * float.value }, { rotate: `${(float.value - 0.5) * 3}deg` }],
  }));
  const shadowStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: 1 - float.value * 0.18 }],
    opacity: 0.22 - float.value * 0.08,
  }));

  return (
    <View style={s.hero}>
      <Animated.View entering={FadeInDown.duration(500)} style={{ alignItems: 'center' }}>
        <View style={{ width: m * 1.5, height: m * 1.12, alignItems: 'center', justifyContent: 'flex-end' }}>
          <View style={[s.halo, { width: m * 1.25, height: m * 1.25, borderRadius: m, bottom: -m * 0.08 }]} />
          <View style={[s.halo2, { width: m * 0.95, height: m * 0.95, borderRadius: m, bottom: m * 0.06 }]} />
          <Animated.View style={[s.shadow, { width: m * 0.6 }, shadowStyle]} />
          <Animated.View style={floatStyle}>
            <Image source={MASCOT} resizeMode="contain" style={{ width: m, height: m * 1.05 }} />
          </Animated.View>
        </View>
        {showWordmark ? (
          <Image source={WORDMARK} resizeMode="contain" style={{ width: size === 'lg' ? 132 : 108, height: size === 'lg' ? 46 : 38, marginTop: 6 }} />
        ) : null}
      </Animated.View>
      <Animated.Text entering={FadeInDown.delay(90).duration(450)} style={[s.title, size === 'sm' && { fontSize: 24, lineHeight: 30 }]}>
        {title}
      </Animated.Text>
      <Animated.Text entering={FadeInDown.delay(150).duration(450)} style={s.subtitle}>
        {subtitle}
      </Animated.Text>
    </View>
  );
}

export function AuthCard({ children, delay = 200 }: { children: ReactNode; delay?: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(500)} style={s.card}>
      {children}
    </Animated.View>
  );
}

/* ─── Field ────────────────────────────────────────────────────────────────── */
type FieldProps = TextInputProps & {
  label: string;
  icon: ComponentType<LucideProps>;
  secure?: boolean;
  error?: string | null;
  hint?: ReactNode;
  isFocused?: boolean;
};

export const AuthField = forwardRef<TextInput, FieldProps>(function AuthField(
  { label, icon: Icon, secure, error, hint, isFocused, onFocus, onBlur, style, ...props },
  forwardedRef,
) {
  const localRef = useRef<TextInput>(null);
  const [internalFocused, setInternalFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  const activeFocus = isFocused !== undefined ? isFocused : internalFocused;
  const borderColor = error ? A.danger : activeFocus ? A.brandDeep : A.line;

  const handleContainerPress = () => {
    if (forwardedRef && typeof forwardedRef === 'object' && 'current' in forwardedRef && forwardedRef.current) {
      forwardedRef.current.focus();
    } else {
      localRef.current?.focus();
    }
  };

  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <Pressable
        onPress={handleContainerPress}
        style={[
          s.field,
          { borderColor, backgroundColor: activeFocus ? A.fieldFocus : A.field },
          activeFocus && s.fieldFocused,
        ]}
      >
        <View pointerEvents="none" style={[s.fieldIcon, activeFocus && { backgroundColor: '#FFF1C2' }]}>
          <Icon size={17} color={activeFocus ? A.brandDeep : A.hint} strokeWidth={2.2} />
        </View>
        <TextInput
          ref={forwardedRef || localRef}
          {...props}
          secureTextEntry={secure ? hidden : false}
          placeholderTextColor={A.hint}
          onFocus={(e) => {
            setInternalFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setInternalFocused(false);
            onBlur?.(e);
          }}
          style={[s.input, style]}
        />
        {secure ? (
          <StyledPressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            style={s.eye}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Hiện mật khẩu' : 'Ẩn mật khẩu'}
          >
            {hidden ? <EyeOff size={18} color={A.hint} /> : <Eye size={18} color={A.sub} />}
          </StyledPressable>
        ) : null}
      </Pressable>
      {error ? <Text style={s.fieldError}>{error}</Text> : hint ?? null}
    </View>
  );
});

/* ─── Feedback ─────────────────────────────────────────────────────────────── */
export function AuthError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <Animated.View entering={FadeInDown.duration(250)} style={s.errorBox}>
      <TriangleAlert size={16} color={A.danger} />
      <Text style={s.errorText}>{message}</Text>
    </Animated.View>
  );
}

/* ─── Buttons ──────────────────────────────────────────────────────────────── */
export function AuthButton({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const off = disabled || loading;
  return (
    <StyledPressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      style={({ pressed }) => [s.btnWrap, pressed && !off && { transform: [{ scale: 0.98 }] }, off && { opacity: 0.7 }]}
    >
      <LinearGradient
        colors={['#FFD84D', A.brand, '#FFB800']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.btn}
      >
        {loading ? <ActivityIndicator color={A.brandInk} size="small" /> : null}
        <Text style={s.btnText}>{label}</Text>
      </LinearGradient>
    </StyledPressable>
  );
}

export function AuthLink({ question, action, onPress }: { question: string; action: string; onPress: () => void }) {
  return (
    <View style={s.footer}>
      <Text style={s.footerText}>{question}</Text>
      <StyledPressable onPress={onPress} hitSlop={8} accessibilityRole="link">
        <Text style={s.footerLink}>{action}</Text>
      </StyledPressable>
    </View>
  );
}

export function AuthCheckbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <StyledPressable
      onPress={() => onChange(!checked)}
      style={s.checkRow}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <View style={[s.checkBox, checked && s.checkBoxOn]}>
        {checked ? <Check size={14} color={A.brandInk} strokeWidth={3} /> : null}
      </View>
      <Text style={s.checkText}>{children}</Text>
    </StyledPressable>
  );
}

/** Password requirements checklist + 4-segment strength bar. */
export function PasswordStrength({ password }: { password: string }) {
  const rules = [
    { ok: password.length >= 8, label: '8+ ký tự' },
    { ok: /[A-Z]/.test(password), label: 'Chữ hoa' },
    { ok: /[a-z]/.test(password), label: 'Chữ thường' },
    { ok: /\d/.test(password), label: 'Chữ số' },
  ];
  const score = rules.filter((r) => r.ok).length;
  const color = score <= 1 ? A.danger : score <= 3 ? A.brandDeep : A.ok;
  if (!password) return null;
  return (
    <View style={{ gap: 8, marginTop: 2 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[s.bar, { backgroundColor: i < score ? color : A.line }]} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {rules.map((r) => (
          <View key={r.label} style={[s.rule, r.ok && s.ruleOk]}>
            {r.ok ? <Check size={11} color={A.ok} strokeWidth={3} /> : <View style={s.ruleDot} />}
            <Text style={[s.ruleText, r.ok && { color: A.ok }]}>{r.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ─── Styles ───────────────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: A.bg, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999 },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 8 },

  hero: { alignItems: 'center', paddingTop: 4, paddingBottom: 18 },
  halo: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.55)' },
  halo2: { position: 'absolute', backgroundColor: 'rgba(255,214,77,0.45)' },
  shadow: { position: 'absolute', bottom: 0, height: 10, borderRadius: 10, backgroundColor: '#8A5A00' },
  title: {
    marginTop: 10,
    color: A.ink,
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '900',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 6,
    color: A.sub,
    fontSize: 14.5,
    lineHeight: 21,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 300,
  },

  card: {
    backgroundColor: A.card,
    borderRadius: 28,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(240,230,210,0.9)',
    shadowColor: '#B88A1A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 6,
  },

  label: { color: A.ink, fontSize: 13, fontWeight: '700', marginLeft: 2 },
  field: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 12,
    gap: 8,
  },
  fieldFocused: {
    shadowColor: A.brandDeep,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 2,
  },
  fieldIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5EEDD',
  },
  input: { flex: 1, color: A.ink, fontSize: 15.5, fontWeight: '600', paddingVertical: 12 },
  eye: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  fieldError: { color: A.danger, fontSize: 12, fontWeight: '600', marginLeft: 4 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: A.dangerBg,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#FFD5D2',
  },
  errorText: { flex: 1, color: '#B42318', fontSize: 13, lineHeight: 18, fontWeight: '600' },

  btnWrap: {
    borderRadius: 18,
    shadowColor: '#E09A00',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 6,
  },
  btn: {
    height: 56,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  btnText: { color: A.brandInk, fontSize: 16.5, fontWeight: '900', letterSpacing: 0.2 },

  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 22 },
  footerText: { color: A.sub, fontSize: 14.5, fontWeight: '500' },
  footerLink: { color: A.link, fontSize: 14.5, fontWeight: '900' },

  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#D9CDB5',
    backgroundColor: A.field,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkBoxOn: { backgroundColor: A.brand, borderColor: A.brandDeep },
  checkText: { flex: 1, color: A.sub, fontSize: 13, lineHeight: 19, fontWeight: '500' },

  bar: { flex: 1, height: 5, borderRadius: 3 },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#F7F1E4',
  },
  ruleOk: { backgroundColor: '#E8F7EF' },
  ruleDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: A.hint },
  ruleText: { fontSize: 11.5, fontWeight: '700', color: A.hint },
});
