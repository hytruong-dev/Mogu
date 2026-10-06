import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/navigation/types';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, Compass, HeartPulse, Home, UserRound } from '@/components/icons';
import { FoodScanSheet } from './FoodScanSheet';
import { StyledPressable as Pressable } from '../ui/styled-pressable';

export type MainTab = 'home' | 'explore' | 'random' | 'health' | 'profile';

type Props = {
  active: MainTab;
  onHome?: () => void;
  onExplore?: () => void;
  onRandom?: () => void;
  onHealth?: () => void;
  onProfile?: () => void;
};

const tabs = [
  { key: 'home', label: 'Trang chủ', icon: Home },
  { key: 'explore', label: 'Khám phá', icon: Compass },
  { key: 'random', label: 'Quét món', icon: Camera },
  { key: 'health', label: 'Sức khỏe', icon: HeartPulse },
  { key: 'profile', label: 'Cá nhân', icon: UserRound },
] as const;

const INK = '#1F1A14';
const MUTED = '#8A8378';
const ACCENT = '#FFC928';

function tapFeedback() {
  Haptics.selectionAsync().catch(() => undefined);
}

export function LiquidGlassBottomNav({ active, ...actions }: Props) {
  const [scanOpen, setScanOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const callbacks: Record<MainTab, (() => void) | undefined> = {
    home: actions.onHome,
    explore: actions.onExplore,
    random: () => setScanOpen(true),
    health: actions.onHealth,
    profile: actions.onProfile,
  };

  return (
    <View
      style={[styles.root, { bottom: Math.max(insets.bottom, 10) }]}
      pointerEvents="box-none"
    >
      <View style={styles.shadowShell}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 40 : 24}
          tint="light"
          style={styles.glass}
        >
          {/* Hairline top reflection for the glass edge */}
          <View pointerEvents="none" style={styles.reflection} />

          <View style={styles.row}>
            {tabs.map(({ key, label, icon: Icon }) => {
              const selected = active === key;

              if (key === 'random') {
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel="Quét món ăn bằng camera"
                    onPress={() => {
                      tapFeedback();
                      callbacks.random?.();
                    }}
                    style={styles.tab}
                    hitSlop={6}
                  >
                    {({ pressed }) => (
                      <>
                        <View style={[styles.orbRing, pressed && styles.orbPressed]}>
                          <LinearGradient
                            colors={['#FFE07A', ACCENT, '#FFB300']}
                            start={{ x: 0.15, y: 0 }}
                            end={{ x: 0.85, y: 1 }}
                            style={styles.orb}
                          >
                            <View pointerEvents="none" style={styles.orbHighlight} />
                            <Icon size={25} color={INK} strokeWidth={2.2} />
                          </LinearGradient>
                        </View>
                        <Text style={[styles.label, styles.labelScan]} numberOfLines={1}>
                          {label}
                        </Text>
                      </>
                    )}
                  </Pressable>
                );
              }

              return (
                <Pressable
                  key={key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  accessibilityLabel={label}
                  onPress={() => {
                    if (!selected) tapFeedback();
                    callbacks[key]?.();
                  }}
                  style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
                >
                  <View style={[styles.iconPill, selected && styles.iconPillActive]}>
                    <Icon
                      size={22}
                      color={selected ? INK : MUTED}
                      strokeWidth={selected ? 2.3 : 1.9}
                      fill={selected ? ACCENT : 'transparent'}
                    />
                  </View>
                  <Text
                    style={[styles.label, selected ? styles.labelActive : styles.labelIdle]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </BlurView>
      </View>

      <FoodScanSheet
        visible={scanOpen}
        onClose={() => setScanOpen(false)}
        onViewDish={(dishId, title) => {
          setScanOpen(false);
          navigation.navigate('FoodDetail', { dishId, title });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 14,
    right: 14,
  },
  shadowShell: {
    height: 72,
    borderRadius: 28,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.94)',
    shadowColor: '#3D2C0A',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  glass: {
    flex: 1,
    borderRadius: 28,
    overflow: 'visible',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(255,255,255,0.85)',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  reflection: {
    position: 'absolute',
    top: 1,
    left: 24,
    right: 24,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  tab: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.95 }],
  },
  iconPill: {
    width: 52,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: {
    backgroundColor: 'rgba(255,201,40,0.22)',
  },
  label: {
    marginTop: 3,
    fontSize: 11.5,
    lineHeight: 14,
    letterSpacing: 0.1,
  },
  labelActive: {
    color: INK,
    fontWeight: '700',
  },
  labelIdle: {
    color: MUTED,
    fontWeight: '500',
  },
  labelScan: {
    color: INK,
    fontWeight: '700',
  },
  orbRing: {
    marginTop: -30,
    width: 62,
    height: 62,
    borderRadius: 31,
    padding: 4,
    backgroundColor: '#FFFFFF',
    shadowColor: '#E0A100',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  orbPressed: {
    transform: [{ scale: 0.93 }],
  },
  orb: {
    flex: 1,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  orbHighlight: {
    position: 'absolute',
    top: 6,
    left: 10,
    width: 20,
    height: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.55)',
    transform: [{ rotate: '-20deg' }],
  },
});
