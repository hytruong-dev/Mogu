import type { ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View, type ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ArrowLeft, ArrowRight, Check, type LucideIcon } from '@/components/icons';
import { cardShadow, ob } from './theme';

// ─── Header: back + segmented progress + skip ─────────────────────────────────

export function OnboardingHeader({
  current,
  total,
  onBack,
  onSkip,
}: {
  /** 1-based index của câu hỏi, 0 = ẩn progress */
  current: number;
  total: number;
  onBack?: () => void;
  onSkip?: () => void;
}) {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10 }}>
      <View style={{ height: 40, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: ob.surface,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: ob.border,
            }}
          >
            <ArrowLeft size={20} color={ob.ink} />
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}

        <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
          {current > 0 &&
            Array.from({ length: total }, (_, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i < current ? ob.primary : ob.border,
                }}
              />
            ))}
        </View>

        {onSkip ? (
          <Pressable onPress={onSkip} hitSlop={12} accessibilityRole="button" style={{ minWidth: 52, alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: ob.sub }}>Bỏ qua</Text>
          </Pressable>
        ) : (
          <View style={{ width: 52 }} />
        )}
      </View>
    </View>
  );
}

// ─── Step title với mascot nhỏ bên phải (tiết kiệm chiều cao màn) ───────────────

export function StepTitle({
  eyebrow,
  title,
  subtitle,
  mascot,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  mascot?: ImageSourcePropType;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <View style={{ flex: 1 }}>
        {eyebrow ? (
          <Text style={{ fontSize: 13, fontWeight: '700', color: ob.gold700, letterSpacing: 0.4, marginBottom: 6 }}>
            {eyebrow}
          </Text>
        ) : null}
        <Text style={{ fontSize: 26, fontWeight: '800', color: ob.ink, lineHeight: 32, letterSpacing: -0.5 }}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ fontSize: 14, color: ob.sub, lineHeight: 20, marginTop: 6 }}>{subtitle}</Text>
        ) : null}
      </View>
      {mascot ? (
        <View
          style={{
            width: 92,
            height: 92,
            borderRadius: 46,
            backgroundColor: ob.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <Image source={mascot} resizeMode="contain" style={{ width: 86, height: 86, marginTop: 10 }} />
        </View>
      ) : null}
    </View>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

export function Section({
  icon: Icon,
  iconTone = 'gold',
  title,
  hint,
  right,
  children,
}: {
  icon?: LucideIcon;
  iconTone?: 'gold' | 'danger' | 'green';
  title: string;
  hint?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  const tone = {
    gold: { bg: ob.primarySoft, fg: ob.gold700 },
    danger: { bg: ob.dangerSoft, fg: ob.danger },
    green: { bg: ob.successSoft, fg: ob.success },
  }[iconTone];
  return (
    <View
      style={[
        { backgroundColor: ob.surface, borderRadius: 20, padding: 16, marginBottom: 12 },
        cardShadow,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: hint ? 2 : 12 }}>
        {Icon ? (
          <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={16} color={tone.fg} />
          </View>
        ) : null}
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: ob.ink }}>{title}</Text>
        {right}
      </View>
      {hint ? (
        <Text style={{ fontSize: 12.5, color: ob.muted, marginBottom: 12, marginLeft: Icon ? 40 : 0 }}>{hint}</Text>
      ) : null}
      {children}
    </View>
  );
}

// ─── Chip (multi/single select) ───────────────────────────────────────────────

export function Chip({
  label,
  active,
  onPress,
  tone = 'gold',
  icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  tone?: 'gold' | 'danger';
  icon?: ReactNode;
}) {
  const danger = tone === 'danger';
  const activeBg = danger ? ob.dangerSoft : ob.primarySoft;
  const activeBorder = danger ? ob.danger : ob.primary;
  const activeFg = danger ? ob.danger : ob.ink;
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        height: 38,
        borderRadius: 19,
        borderWidth: 1.5,
        borderColor: active ? activeBorder : ob.border,
        backgroundColor: active ? activeBg : ob.surface,
      }}
    >
      {active ? <Check size={14} color={activeFg} strokeWidth={3} /> : icon}
      <Text style={{ fontSize: 14, fontWeight: active ? '700' : '500', color: active ? activeFg : ob.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ChipWrap({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>;
}

// ─── Primary CTA ──────────────────────────────────────────────────────────────

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const inactive = disabled || loading;

  return (
    <Animated.View style={anim}>
      <Pressable
        disabled={inactive}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!inactive, busy: !!loading }}
        onPress={() => {
          scale.value = withSequence(withTiming(0.97, { duration: 70 }), withSpring(1, { damping: 12, stiffness: 240 }));
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
      >
        <LinearGradient
          colors={disabled ? [ob.disabled, ob.disabled] : [ob.primary, '#FFD84D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            height: 56,
            borderRadius: 28,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            shadowColor: '#C99400',
            shadowOpacity: disabled ? 0 : 0.28,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: disabled ? 0 : 4,
          }}
        >
          {loading ? (
            <ActivityIndicator color={ob.ink} />
          ) : (
            <>
              <Text style={{ fontSize: 17, fontWeight: '800', color: disabled ? '#FFFFFF' : ob.ink }}>{label}</Text>
              <ArrowRight size={20} color={disabled ? '#FFFFFF' : ob.ink} strokeWidth={2.5} />
            </>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

export function Footer({ children, error }: { children: ReactNode; error?: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 8,
        backgroundColor: ob.bg,
        borderTopWidth: 1,
        borderTopColor: 'rgba(233,222,201,0.6)',
      }}
    >
      {error ? (
        <View style={{ backgroundColor: ob.dangerSoft, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 }}>
          <Text style={{ fontSize: 13, color: ob.danger, textAlign: 'center' }}>{error}</Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function InfoNote({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, marginTop: 4 }}>
      <Icon size={16} color={ob.muted} />
      <Text style={{ flex: 1, fontSize: 12.5, color: ob.muted, lineHeight: 18 }}>{children}</Text>
    </View>
  );
}
