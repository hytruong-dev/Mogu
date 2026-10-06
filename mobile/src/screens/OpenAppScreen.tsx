import { useEffect, useRef } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/* ─── Assets ───────────────────────────────────────────────────────────────── */
const LAYERS = {
  background: require('../assets/images/noan/splash-layers-v2/background.png'),
  frame: require('../assets/images/noan/splash-layers-v2/trimmed/frame.png'),
  mascot: require('../assets/images/noan/splash-layers-v2/trimmed/mascot.png'),
  letters: [
    { src: require('../assets/images/noan/splash-layers-v2/trimmed/letter-n-1.png'), ratio: 420 / 344 },
    { src: require('../assets/images/noan/splash-layers-v2/trimmed/letter-o.png'), ratio: 420 / 402 },
    { src: require('../assets/images/noan/splash-layers-v2/trimmed/letter-a.png'), ratio: 420 / 354 },
    { src: require('../assets/images/noan/splash-layers-v2/trimmed/letter-n-2.png'), ratio: 420 / 344 },
  ],
} as const;
const STAGE_RATIO = 659 / 720;

const SOUNDS = {
  whoosh: require('../assets/audio/splash/whoosh.wav'),
  boing: require('../assets/audio/splash/boing.wav'),
  pops: [
    require('../assets/audio/splash/pop1.wav'),
    require('../assets/audio/splash/pop2.wav'),
    require('../assets/audio/splash/pop3.wav'),
    require('../assets/audio/splash/pop4.wav'),
  ],
  chime: require('../assets/audio/splash/chime.wav'),
} as const;

/* ─── Timeline (ms) — Tight, snappy, cinematic rhythm ──────────────────────── */
const T = {
  frame: 100,
  mascot: 380,
  letters: [680, 790, 900, 1010],
  tagline: 1160,
  settle: 1450,
  minShow: 2000,
};

/** Small decorations around the frame */
const DECOR = [
  { emoji: '🌶️', x: 0.4, y: 0.12, size: 26, rot: 28, delay: 620 },
  { emoji: '🍃', x: -0.44, y: 0.2, size: 22, rot: -20, delay: 700 },
  { emoji: '✨', x: -0.36, y: -0.36, size: 18, rot: 0, delay: 780 },
  { emoji: '✨', x: 0.38, y: -0.3, size: 16, rot: 0, delay: 860 },
  { emoji: '🌿', x: -0.42, y: -0.08, size: 18, rot: 12, delay: 940 },
] as const;

type Props = {
  onFinish: () => void;
  onSettle?: () => void;
};

/* ─── Sound helper — Staggered async creation to avoid cold-start hitch ─────── */
function useSplashSounds() {
  const players = useRef<Record<string, AudioPlayer>>({});

  useEffect(() => {
    const timer = setTimeout(() => {
      const make = (key: string, src: any, volume: number) => {
        try {
          const p = createAudioPlayer(src);
          p.volume = volume;
          players.current[key] = p;
        } catch {
          // ignore if unavailable
        }
      };
      make('whoosh', SOUNDS.whoosh, 0.35);
      make('boing', SOUNDS.boing, 0.4);
      make('pop', SOUNDS.pops[0], 0.35);
      make('chime', SOUNDS.chime, 0.45);
    }, 40);

    return () => {
      clearTimeout(timer);
      Object.values(players.current).forEach((p) => {
        try {
          p.remove();
        } catch {
          // ignore
        }
      });
      players.current = {};
    };
  }, []);

  return (key: string) => {
    try {
      const p = players.current[key] ?? players.current['pop'];
      if (!p) return;
      const r = (p as any).play?.();
      if (r && typeof r.catch === 'function') r.catch(() => undefined);
    } catch {
      // ignore
    }
  };
}

const haptic = (style: Haptics.ImpactFeedbackStyle) => {
  try {
    void Haptics.impactAsync(style).catch(() => undefined);
  } catch {
    // ignore
  }
};

/* ─── Screen ───────────────────────────────────────────────────────────────── */
export function OpenAppScreen({ onFinish, onSettle }: Props) {
  const { width, height } = useWindowDimensions();
  const play = useSplashSounds();
  const finishedRef = useRef(false);

  // Layout
  const stageW = Math.min(width * 0.72, 340);
  const stageH = stageW * STAGE_RATIO;
  const letterH = Math.min(width * 0.17, 82);
  const letterOverlap = letterH * 0.2;

  // Shared values — lean, zero-sine loop
  const screenOpacity = useSharedValue(1);
  const screenScale = useSharedValue(1);
  const bgIn = useSharedValue(0);
  const frameIn = useSharedValue(0);
  const mascotIn = useSharedValue(0);
  const idleY = useSharedValue(0);
  const taglineIn = useSharedValue(0);
  const l0 = useSharedValue(0);
  const l1 = useSharedValue(0);
  const l2 = useSharedValue(0);
  const l3 = useSharedValue(0);
  const letters = [l0, l1, l2, l3];

  const exitScreen = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    screenScale.value = withTiming(1.05, { duration: 320, easing: Easing.out(Easing.cubic) });
    screenOpacity.value = withTiming(0, { duration: 300, easing: Easing.inOut(Easing.quad) });
    setTimeout(onFinish, 300);
  };

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

    // 1 — Background smooth alpha fade-in (no heavy full-screen scaling)
    bgIn.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) });

    // 2 — Frame swings in crisp and snappy
    frameIn.value = withDelay(T.frame, withSpring(1, { damping: 14, stiffness: 140, mass: 0.8 }));
    at(T.frame, () => play('whoosh'));

    // 3 — Mascot lands with squash/stretch spring bounce
    mascotIn.value = withDelay(T.mascot, withSpring(1, { damping: 12, stiffness: 150, mass: 0.7 }));
    at(T.mascot + 40, () => {
      play('boing');
      haptic(Haptics.ImpactFeedbackStyle.Light);
    });

    // 4 — Letters drop in sequence and firmly lock in place
    letters.forEach((l, i) => {
      l.value = withDelay(T.letters[i], withSpring(1, { damping: 12, stiffness: 180, mass: 0.5 }));
      at(T.letters[i] + 40, () => play('pop'));
    });
    // Distinct lockup haptic on completion
    at(T.letters[3] + 80, () => haptic(Haptics.ImpactFeedbackStyle.Medium));

    // 5 — Tagline fade-in
    taglineIn.value = withDelay(T.tagline, withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) }));
    at(T.tagline + 80, () => play('chime'));

    // 6 — Idle breathing on the entire stage (runs on native UI thread, zero worklet overhead)
    idleY.value = withDelay(
      T.settle,
      withRepeat(
        withSequence(
          withTiming(-4, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      ),
    );

    // 7 — Settle notification (safely mounts destination screen underneath)
    at(T.settle, () => {
      onSettle?.();
    });

    // 8 — Exit splash screen after minShow
    at(T.minShow, () => {
      exitScreen();
    });

    return () => {
      timers.forEach(clearTimeout);
      cancelAnimation(idleY);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Animated styles — Clean, native-evaluated, no worklet string allocations ─── */
  const screenStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
    transform: [{ scale: screenScale.value }],
  }));

  const bgStyle = useAnimatedStyle(() => ({
    opacity: bgIn.value,
  }));

  const glowStyle = useAnimatedStyle(() => {
    const f = frameIn.value;
    return {
      opacity: f * 0.65,
      transform: [{ scale: 0.85 + f * 0.15 }],
    };
  });

  const stageFloat = useAnimatedStyle(() => ({
    transform: [{ translateY: idleY.value }],
  }));

  const frameStyle = useAnimatedStyle(() => {
    const f = frameIn.value;
    return {
      opacity: Math.min(1, f * 1.5),
      transform: [
        { translateY: (1 - f) * 50 },
        { scale: 0.4 + f * 0.6 },
      ],
    };
  });

  const mascotStyle = useAnimatedStyle(() => {
    const p = mascotIn.value;
    const sx = 1 + (1 - p) * -0.2;
    const sy = 1 + (1 - p) * 0.15;
    return {
      opacity: Math.min(1, p * 2),
      transform: [
        { translateY: (1 - p) * stageH * 0.2 },
        { scaleX: (0.6 + p * 0.4) * sx },
        { scaleY: (0.6 + p * 0.4) * sy },
      ],
    };
  });

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineIn.value,
    transform: [{ translateY: (1 - taglineIn.value) * 12 }],
  }));

  return (
    <Animated.View style={[styles.root, screenStyle]}>
      {/* Background — hardware cached with expo-image */}
      <Animated.View style={[StyleSheet.absoluteFill, bgStyle]}>
        <Image
          source={LAYERS.background}
          contentFit="cover"
          style={styles.fill}
          priority="high"
          cachePolicy="memory-disk"
        />
      </Animated.View>

      <View style={[styles.center, { paddingBottom: height * 0.06 }]}>
        <Animated.View style={[{ alignItems: 'center' }, stageFloat]}>
          {/* Stage: glow + frame + mascot + decorations */}
          <View style={{ width: stageW, height: stageH }}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.glow,
                {
                  width: stageW * 1.25,
                  height: stageW * 1.25,
                  borderRadius: stageW,
                  left: -stageW * 0.125,
                  top: stageH / 2 - stageW * 0.625,
                },
                glowStyle,
              ]}
            >
              <LinearGradient
                colors={['rgba(255,214,90,0.5)', 'rgba(255,214,90,0)']}
                start={{ x: 0.5, y: 0.5 }}
                end={{ x: 0.5, y: 1 }}
                style={[StyleSheet.absoluteFill, { borderRadius: stageW }]}
              />
            </Animated.View>

            <Animated.View style={[StyleSheet.absoluteFill, frameStyle]}>
              <Image
                source={LAYERS.frame}
                contentFit="contain"
                style={styles.fill}
                priority="high"
                cachePolicy="memory-disk"
              />
            </Animated.View>

            <Animated.View style={[StyleSheet.absoluteFill, mascotStyle]}>
              <Image
                source={LAYERS.mascot}
                contentFit="contain"
                style={styles.fill}
                priority="high"
                cachePolicy="memory-disk"
              />
            </Animated.View>

            {DECOR.map((d, i) => (
              <Decor key={i} {...d} stageW={stageW} stageH={stageH} />
            ))}
          </View>

          {/* Wordmark — each letter drops in crisp & solid */}
          <View style={[styles.letters, { marginTop: -letterH * 0.12 }]} accessibilityRole="image" accessibilityLabel="NOAN">
            {LAYERS.letters.map((l, i) => (
              <Letter
                key={i}
                index={i}
                src={l.src}
                h={letterH}
                w={letterH * l.ratio}
                overlap={i === 0 ? 0 : letterOverlap}
                p={letters[i]}
              />
            ))}
          </View>

          <Animated.View style={taglineStyle}>
            <Text style={styles.tagline}>Hôm nay ăn gì? Để NOAN lo!</Text>
          </Animated.View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

/* ─── Letter ───────────────────────────────────────────────────────────────── */
function Letter({
  index,
  src,
  w,
  h,
  overlap,
  p,
}: {
  index: number;
  src: any;
  w: number;
  h: number;
  overlap: number;
  p: SharedValue<number>;
}) {
  const tilt = index % 2 === 0 ? -1 : 1;
  const style = useAnimatedStyle(() => {
    const val = p.value;
    return {
      opacity: Math.min(1, val * 2.5),
      transform: [
        { translateY: (1 - val) * -h * 1.2 },
        { scale: 0.4 + val * 0.6 },
        { rotate: `${(1 - val) * 18 * tilt}deg` },
      ],
    };
  });

  return (
    <Animated.View style={[{ width: w, height: h, marginLeft: -overlap, zIndex: 10 - index }, style]}>
      <Image
        source={src}
        contentFit="contain"
        style={styles.fill}
        priority="high"
        cachePolicy="memory-disk"
      />
    </Animated.View>
  );
}

/* ─── Decorations ─────────────────────────────────────────────────────────── */
function Decor({
  emoji,
  x,
  y,
  size,
  rot,
  delay,
  stageW,
  stageH,
}: {
  emoji: string;
  x: number;
  y: number;
  size: number;
  rot: number;
  delay: number;
  stageW: number;
  stageH: number;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withSpring(1, { damping: 11, stiffness: 120 }));
  }, [t, delay]);

  const tx = x * stageW * 1.05;
  const ty = y * stageH;

  const style = useAnimatedStyle(() => {
    const v = t.value;
    return {
      opacity: Math.min(1, v),
      transform: [
        { translateX: tx * v },
        { translateY: ty * v },
        { scale: 0.3 + v * 0.7 },
        { rotate: `${rot + (1 - v) * 80}deg` },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.decor, { left: stageW / 2 - size / 2, top: stageH / 2 - size / 2, width: size + 4, height: size + 4 }, style]}
    >
      <Text style={{ fontSize: size }}>{emoji}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FDE17C', overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', overflow: 'hidden' },
  letters: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
  decor: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  tagline: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '800',
    color: '#5A3A1E',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(255,255,255,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
