import { useEffect } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

type SkeletonProps = {
  style?: StyleProp<ViewStyle>;
  /** Kept for backwards compatibility; layout must come from `style`. */
  className?: string;
  /** Pulse period in ms. */
  duration?: number;
  children?: React.ReactNode;
};

/**
 * Skeleton — plain `StyleSheet` + Reanimated pulse (no NativeWind interop),
 * so it renders identically in dev builds and the release APK.
 */
function Skeleton({ style, duration = 1100, children }: SkeletonProps) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(t);
  }, [duration, t]);

  const pulse = useAnimatedStyle(() => ({ opacity: 0.55 + t.value * 0.45 }));

  return <Animated.View style={[s.base, style, pulse]}>{children}</Animated.View>;
}

const s = StyleSheet.create({
  base: { backgroundColor: '#EDE4D0', borderRadius: 8, overflow: 'hidden' },
});

export { Skeleton };
