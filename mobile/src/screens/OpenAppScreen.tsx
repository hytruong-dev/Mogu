import { useEffect, useRef } from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
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
  // frame + mascot share the same canvas (720×659) so they always line up.
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

/* ─── Timeline (ms) ────────────────────────────────────────────────────────── */
const T = {
  frame: 180,
  mascot: 560,
  letters: [940, 1060, 1180, 1300],
  tagline: 1520,
  shine: 1560,
  minShow: 2700,
};

/** Small decorations that drift in around the frame (like the reference art). */
const DECOR = [
  { emoji: '🌶️', x: 0.4, y: 0.12, size: 26, rot: 28, delay: 820 },
  { emoji: '🍃', x: -0.44, y: 0.2, size: 22, rot: -20, delay: 900 },
  { emoji: '✨', x: -0.36, y: -0.36, size: 18, rot: 0, delay: 1000 },
  { emoji: '✨', x: 0.38, y: -0.3, size: 16, rot: 0, delay: 1120 },
  { emoji: '🌿', x: -0.42, y: -0.08, size: 18, rot: 12, delay: 1240 },
] as const;

type Props = {
  onFinish: () => void;
  ready?: boolean;
};

/* ─── Sound helper ─────────────────────────────────────────────────────────── */
function useSplashSounds() {
  const players = useRef<Record<string, AudioPlayer>>({});

  useEffect(() => {
    const make = (key: string, src: number, volume: number) => {
      try {
        const p = createAudioPlayer(src);
        p.volume = volume;
        players.current[key] = p;
      } catch {
        // audio unavailable (web autoplay policy, etc.) — animation still runs
      }
    };
    make('whoosh', SOUNDS.whoosh, 0.45);
    make('boing', SOUNDS.boing, 0.5);
    SOUNDS.pops.forEach((s, i) => make(`pop${i}`, s, 0.42));
    make('chime', SOUNDS.chime, 0.5);

    const all = players.current;
    return () => {
      Object.values(all).forEach((p) => {
        try {
          p.remove();
        } catch {
          // already released
        }
      });
      players.current = {};
    };
  }, []);

  return (key: string) => {
    const p = players.current[key];
    if (!p) return;
    try {
      const r = (p as any).play?.();
      if (r && typeof r.catch === 'function') r.catch(() => undefined);
    } catch {
      // ignore
    }
  };
}

const haptic = (style: Haptics.ImpactFeedbackStyle) =>
  void Haptics.impactAsync(style).catch(() => undefined);

/* ─── Screen ───────────────────────────────────────────────────────────────── */
export function OpenAppScreen({ onFinish, ready = true }: Props) {
  const { width, height } = useWindowDimensions();
  const play = useSplashSounds();
  const minTimeElapsed = useRef(false);
  const finishedRef = useRef(false);

  // Layout
  const stageW = Math.min(width * 0.72, 340);
  const stageH = stageW * STAGE_RATIO;
  const letterH = Math.min(width * 0.17, 82);
  const letterOverlap = letterH * 0.2;

  // Shared values
  const screenOpacity = useSharedValue(1);
  const screenScale = useSharedValue(1);
  const bgIn = useSharedValue(0);
  const glow = useSharedValue(0);
  const frameIn = useSharedValue(0);
  const mascotIn = useSharedValue(0);
  const idle = useSharedValue(0);
  const shine = useSharedValue(0);
  const taglineIn = useSharedValue(0);
  const l0 = useSharedValue(0);
  const l1 = useSharedValue(0);
  const l2 = useSharedValue(0);
  const l3 = useSharedValue(0);
  const letters = [l0, l1, l2, l3];

  const exitScreen = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    screenScale.value = withTiming(1.08, { duration: 360, easing: Easing.in(Easing.cubic) });
    screenOpacity.value = withTiming(0, { duration: 340, easing: Easing.inOut(Easing.quad) });
    setTimeout(onFinish, 340);
  };

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

    // 1 — background settles in (Ken Burns)
    bgIn.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
    glow.value = withDelay(
      T.frame,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.55, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );

    // 2 — frame swings in
    frameIn.value = withDelay(T.frame, withSpring(1, { damping: 10, stiffness: 140, mass: 0.8 }));
    at(T.frame, () => play('whoosh'));

    // 3 — mascot pops out of the frame
    mascotIn.value = withDelay(T.mascot, withSpring(1, { damping: 8, stiffness: 160, mass: 0.7 }));
    at(T.mascot, () => {
      play('boing');
      haptic(Haptics.ImpactFeedbackStyle.Medium);
    });

    // 4 — letters drop one by one
    letters.forEach((l, i) => {
      l.value = withDelay(T.letters[i], withSpring(1, { damping: 7, stiffness: 190, mass: 0.6 }));
      at(T.letters[i] + 60, () => {
        play(`pop${i}`);
        haptic(Haptics.ImpactFeedbackStyle.Light);
      });
    });

    // 5 — tagline + sparkle
    taglineIn.value = withDelay(T.tagline, withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) }));
    shine.value = withDelay(
      T.shine,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 750, easing: Easing.inOut(Easing.quad) }),
          withDelay(1500, withTiming(0, { duration: 0 })),
        ),
        -1,
        false,
      ),
    );
    at(T.shine, () => play('chime'));

    // 6 — idle breathing loop for everything once on stage
    idle.value = withDelay(
      T.tagline,
      withRepeat(withTiming(1, { duration: 2400, easing: Easing.linear }), -1, false),
    );

    at(T.minShow, () => {
      minTimeElapsed.current = true;
      if (ready) exitScreen();
    });

    return () => {
      timers.forEach(clearTimeout);
      [glow, idle, shine].forEach((v) => cancelAnimation(v));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready && minTimeElapsed.current) exitScreen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  /* ─── Animated styles ─── */
  const screenStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
    transform: [{ scale: screenScale.value }],
  }));

  const bgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(bgIn.value, [0, 1], [0.4, 1]),
    transform: [{ scale: interpolate(bgIn.value, [0, 1], [1.12, 1]) }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value * Math.min(1, frameIn.value),
    transform: [{ scale: 0.9 + glow.value * 0.15 }],
  }));

  const stageFloat = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.sin(idle.value * Math.PI * 2) * 5 }],
  }));

  const frameStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, frameIn.value * 1.6),
    transform: [
      { translateY: (1 - frameIn.value) * 60 },
      { scale: 0.35 + frameIn.value * 0.65 },
      { rotate: `${(1 - frameIn.value) * -14}deg` },
    ],
  }));

  const mascotStyle = useAnimatedStyle(() => {
    const p = mascotIn.value;
    // squash & stretch while landing + subtle head tilt while idling
    const sx = 1 + (1 - p) * -0.25;
    const sy = 1 + (1 - p) * 0.2;
    return {
      opacity: Math.min(1, p * 2),
      transform: [
        { translateY: (1 - p) * stageH * 0.22 },
        { scaleX: (0.55 + p * 0.45) * sx },
        { scaleY: (0.55 + p * 0.45) * sy },
        { rotate: `${Math.sin(idle.value * Math.PI * 2) * 1.6}deg` },
      ],
    };
  });

  const shineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shine.value, [0, 0.15, 0.85, 1], [0, 1, 1, 0]),
    transform: [
      { translateX: interpolate(shine.value, [0, 1], [-stageW * 0.75, stageW * 0.75]) },
      { rotate: '22deg' },
    ],
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineIn.value,
    transform: [{ translateY: (1 - taglineIn.value) * 14 }],
  }));

  return (
    <Animated.View style={[styles.root, screenStyle]}>
      {/* Background */}
      <Animated.View style={[StyleSheet.absoluteFill, bgStyle]}>
        <Image source={LAYERS.background} resizeMode="cover" fadeDuration={0} style={styles.fill} />
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
                colors={['rgba(255,214,90,0.55)', 'rgba(255,214,90,0)']}
                start={{ x: 0.5, y: 0.5 }}
                end={{ x: 0.5, y: 1 }}
                style={[StyleSheet.absoluteFill, { borderRadius: stageW }]}
              />
            </Animated.View>

            <Animated.View style={[StyleSheet.absoluteFill, frameStyle]}>
              <Image source={LAYERS.frame} resizeMode="contain" fadeDuration={0} style={styles.fill} />
              {/* glossy sweep across the frame */}
              <View style={[StyleSheet.absoluteFill, styles.shineClip, { borderRadius: stageW * 0.16 }]} pointerEvents="none">
                <Animated.View style={[styles.shine, { height: stageH * 1.6, left: stageW / 2 - 22 }, shineStyle]}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>
              </View>
            </Animated.View>

            <Animated.View style={[StyleSheet.absoluteFill, mascotStyle]}>
              <Image source={LAYERS.mascot} resizeMode="contain" fadeDuration={0} style={styles.fill} />
            </Animated.View>

            {DECOR.map((d, i) => (
              <Decor key={i} {...d} stageW={stageW} stageH={stageH} idle={idle} />
            ))}
          </View>

          {/* Wordmark — each letter drops in */}
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
                idle={idle}
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
  idle,
}: {
  index: number;
  src: number;
  w: number;
  h: number;
  overlap: number;
  p: SharedValue<number>;
  idle: SharedValue<number>;
}) {
  const tilt = index % 2 === 0 ? -1 : 1;
  const style = useAnimatedStyle(() => {
    // gentle "wave" across the word while idling
    const wave = Math.sin((idle.value - index * 0.12) * Math.PI * 2);
    return {
      opacity: Math.min(1, p.value * 2.2),
      transform: [
        { translateY: (1 - p.value) * -h * 1.4 + wave * 2.5 },
        { scale: 0.3 + p.value * 0.7 },
        { rotate: `${(1 - p.value) * 26 * tilt + wave * 1.5}deg` },
      ],
    };
  });
  return (
    <Animated.View style={[{ width: w, height: h, marginLeft: -overlap, zIndex: 10 - index }, style]}>
      <Image source={src} resizeMode="contain" fadeDuration={0} style={styles.fill} />
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
  idle,
}: {
  emoji: string;
  x: number;
  y: number;
  size: number;
  rot: number;
  delay: number;
  stageW: number;
  stageH: number;
  idle: SharedValue<number>;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withSpring(1, { damping: 9, stiffness: 110 }));
  }, [t, delay]);

  const tx = x * stageW * 1.1;
  const ty = y * stageH;
  const phase = delay / 400;

  const style = useAnimatedStyle(() => {
    const bob = Math.sin((idle.value + phase) * Math.PI * 2);
    return {
      opacity: Math.min(1, t.value),
      transform: [
        { translateX: tx * t.value },
        { translateY: ty * t.value + bob * 4 },
        { scale: 0.2 + t.value * 0.8 },
        { rotate: `${rot + (1 - t.value) * 120 + bob * 6}deg` },
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
  shineClip: { overflow: 'hidden', margin: '12%' },
  shine: { position: 'absolute', top: '-30%', width: 44 },
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
