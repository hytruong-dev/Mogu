import { useEffect } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { LoadingDots } from '../components/atoms/LoadingDots';
import { SplashBackground } from '../components/atoms/SplashBackground';
import { Tagline } from '../components/atoms/Tagline';
import { SparkleField } from '../components/molecules/SparkleField';
import { SplashBrand } from '../components/molecules/SplashBrand';

type Props = { onFinish: () => void };

export function OpenAppScreen({ onFinish }: Props) {
  const { width, height } = useWindowDimensions();

  // ─── Reanimated shared values ─────────────────────────────────────────────
  const screenOpacity = useSharedValue(1);
  const backgroundOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.82);
  const mascotOpacity = useSharedValue(0);
  const mascotScale = useSharedValue(0.8);
  const logoOpacity = useSharedValue(0);
  const logoY = useSharedValue(12);
  const taglineOpacity = useSharedValue(0);
  const sparkleOpacity = useSharedValue(0.35);

  const brandWidth = Math.min(width * 0.7, 330);

  useEffect(() => {
    // Background + glow
    backgroundOpacity.value = withTiming(1, {
      duration: 400,
      easing: Easing.out(Easing.quad),
    });
    glowScale.value = withTiming(1, {
      duration: 400,
      easing: Easing.out(Easing.quad),
    });

    // Mascot (delay 300ms)
    mascotOpacity.value = withDelay(300, withTiming(1, { duration: 350 }));
    mascotScale.value = withDelay(300, withSpring(1, { damping: 8, stiffness: 145, mass: 0.7 }));

    // Logo (delay 700ms)
    logoOpacity.value = withDelay(
      700,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
    logoY.value = withDelay(
      700,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );

    // Tagline (delay 1100ms)
    taglineOpacity.value = withDelay(1100, withTiming(1, { duration: 500 }));

    // Sparkle loop
    sparkleOpacity.value = withRepeat(
      withSequence(withTiming(1, { duration: 450 }), withTiming(0.35, { duration: 450 })),
      -1,
      false,
    );

    // Fade out & finish
    const timer = setTimeout(() => {
      screenOpacity.value = withTiming(
        0,
        { duration: 220, easing: Easing.out(Easing.quad) },
        (finished) => {
          if (finished) runOnJS(onFinish)();
        },
      );
    }, 2180);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Screen fade style ────────────────────────────────────────────────────
  const screenStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }));

  return (
    <Animated.View style={[screenStyle, { flex: 1, backgroundColor: '#FFF9E8' }]}>
      <SplashBackground opacity={backgroundOpacity} glowScale={glowScale} />
      <SparkleField opacity={sparkleOpacity} width={width} height={height} />

      <SafeAreaView className="flex-1">
        {/* Brand area */}
        <View className="absolute top-[27%] left-0 right-0 items-center">
          <SplashBrand
            mascotSize={brandWidth}
            wordmarkWidth={brandWidth * 0.88}
            mascotOpacity={mascotOpacity}
            mascotScale={mascotScale}
            logoOpacity={logoOpacity}
            logoY={logoY}
          />

          <Animated.View style={[taglineStyle, { marginTop: 20 }]}>
            <Tagline />
          </Animated.View>
        </View>

        {/* Loading dots */}
        <View className="absolute bottom-[10%] left-0 right-0 items-center">
          <LoadingDots />
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}
