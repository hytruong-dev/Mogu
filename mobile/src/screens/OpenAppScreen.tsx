import { useEffect, useRef } from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
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
import { SparkleField } from '../components/molecules/SparkleField';

const APP_ICON = require('../assets/images/noan/noan-app-icon-v1.png');
const CUSTOM_WORDMARK = require('../assets/images/noan/noan-wordmark-custom-v2.png');

type Props = {
  onFinish: () => void;
  ready?: boolean;
};

export function OpenAppScreen({ onFinish, ready = true }: Props) {
  const { width, height } = useWindowDimensions();
  const minTimeElapsed = useRef(false);
  const finishedRef = useRef(false);

  // ─── Reanimated shared values ─────────────────────────────────────────────
  const screenOpacity = useSharedValue(1);
  const screenScale = useSharedValue(1);

  // Ambient glow
  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.7);

  // Icon card
  const iconOpacity = useSharedValue(0);
  const iconScale = useSharedValue(0.68);
  const iconTranslateY = useSharedValue(0);

  // Wordmark
  const wordmarkOpacity = useSharedValue(0);
  const wordmarkTranslateY = useSharedValue(28);
  const wordmarkScale = useSharedValue(0.92);

  // Sparkles & dots
  const sparkleOpacity = useSharedValue(0);
  const dotsOpacity = useSharedValue(0);

  const cardSize = Math.min(Math.round(width * 0.38), 154);
  const wordmarkWidth = Math.min(Math.round(width * 0.52), 205);
  const wordmarkHeight = Math.round(wordmarkWidth / 2.65);

  const exitScreen = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    if (__DEV__) {
      console.log('[OpenAppScreen] Exiting splash screen');
    }

    screenScale.value = withTiming(1.05, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
    screenOpacity.value = withTiming(0, {
      duration: 280,
      easing: Easing.inOut(Easing.quad),
    });

    setTimeout(() => {
      onFinish();
    }, 280);
  };

  useEffect(() => {
    if (__DEV__) {
      console.log('[OpenAppScreen] Mounted, starting opening animations');
    }

    // 1. Ambient glow expansion
    glowOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) });
    glowScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.95, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );

    // 2. Icon card spring entrance
    iconOpacity.value = withTiming(1, { duration: 320 });
    iconScale.value = withSpring(1, {
      damping: 10,
      stiffness: 140,
      mass: 0.75,
    });

    // Gentle float idle loop for icon
    const floatTimer = setTimeout(() => {
      iconTranslateY.value = withRepeat(
        withSequence(
          withTiming(-6, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
          withTiming(3, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
    }, 500);

    // 3. Wordmark entrance: slide up & fade with slight delay
    wordmarkOpacity.value = withDelay(
      220,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) }),
    );
    wordmarkTranslateY.value = withDelay(
      220,
      withSpring(0, { damping: 11, stiffness: 125, mass: 0.8 }),
    );
    wordmarkScale.value = withDelay(
      220,
      withSpring(1, { damping: 12, stiffness: 130 }),
    );

    // 4. Sparkles and bottom dots
    sparkleOpacity.value = withDelay(380, withTiming(0.45, { duration: 500 }));
    dotsOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));

    // Minimum display timer (1.8s) for smooth brand experience
    const minTimer = setTimeout(() => {
      minTimeElapsed.current = true;
      if (ready) {
        exitScreen();
      }
    }, 1850);

    return () => {
      clearTimeout(floatTimer);
      clearTimeout(minTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready && minTimeElapsed.current) {
      exitScreen();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // ─── Animated Styles ───────────────────────────────────────────────────────
  const screenAnimStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
    transform: [{ scale: screenScale.value }],
  }));

  const glowAnimStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const iconAnimStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
    transform: [
      { scale: iconScale.value },
      { translateY: iconTranslateY.value },
    ],
  }));

  const wordmarkAnimStyle = useAnimatedStyle(() => ({
    opacity: wordmarkOpacity.value,
    transform: [
      { translateY: wordmarkTranslateY.value },
      { scale: wordmarkScale.value },
    ],
  }));

  const dotsAnimStyle = useAnimatedStyle(() => ({
    opacity: dotsOpacity.value,
  }));

  return (
    <Animated.View style={[styles.root, screenAnimStyle]}>
      {/* Ambient warm radial glow */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            width: cardSize * 2.8,
            height: cardSize * 2.8,
            borderRadius: cardSize * 1.4,
          },
          glowAnimStyle,
        ]}
      />

      <SparkleField opacity={sparkleOpacity} width={width} height={height} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          {/* App Icon Card */}
          <Animated.View
            style={[
              styles.iconCard,
              {
                width: cardSize,
                height: cardSize,
                borderRadius: Math.round(cardSize * 0.22),
              },
              iconAnimStyle,
            ]}
          >
            <Image
              source={APP_ICON}
              resizeMode="cover"
              style={[
                styles.iconImage,
                {
                  width: cardSize,
                  height: cardSize,
                  borderRadius: Math.round(cardSize * 0.22),
                },
              ]}
            />
          </Animated.View>

          {/* Custom 3D NOAN Wordmark (replaces plain text) */}
          <Animated.View
            style={[
              styles.wordmarkWrap,
              { width: wordmarkWidth, height: wordmarkHeight },
              wordmarkAnimStyle,
            ]}
          >
            <Image
              source={CUSTOM_WORDMARK}
              resizeMode="contain"
              style={{ width: wordmarkWidth, height: wordmarkHeight }}
              accessibilityRole="image"
              accessibilityLabel="NOAN"
            />
          </Animated.View>
        </View>

        {/* Bottom loading dots */}
        <Animated.View style={[styles.bottomContainer, dotsAnimStyle]}>
          <LoadingDots />
        </Animated.View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
  },
  glow: {
    position: 'absolute',
    top: '32%',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 201, 40, 0.16)',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  iconCard: {
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    // Realistic shadow for iOS & Android
    shadowColor: '#2A1A10',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 10,
  },
  iconImage: {
    overflow: 'hidden',
  },
  wordmarkWrap: {
    marginTop: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 44,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
