import { memo, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const PALETTE = ['#FFC928', '#FFB800', '#FF7A45', '#FF4D6D', '#4CC9F0', '#7BD389', '#FFFFFF'];

type ParticleKind = 'coin' | 'star' | 'confetti';

type ParticleSpec = {
  kind: ParticleKind;
  angle: number;
  distance: number;
  size: number;
  color: string;
  spin: number;
  delay: number;
  duration: number;
};

/** Deterministic pseudo-random so particles don't reshuffle on re-render. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function buildParticles(count: number, radius: number, seed: number): ParticleSpec[] {
  const rnd = seeded(seed);
  return Array.from({ length: count }, (_, i) => {
    const r = rnd();
    const kind: ParticleKind = r < 0.3 ? 'coin' : r < 0.55 ? 'star' : 'confetti';
    return {
      kind,
      angle: (i / count) * Math.PI * 2 + (rnd() - 0.5) * 0.5,
      distance: radius * (0.55 + rnd() * 0.5),
      size: kind === 'confetti' ? 7 + rnd() * 5 : 13 + rnd() * 9,
      color: PALETTE[Math.floor(rnd() * PALETTE.length)],
      spin: (rnd() - 0.5) * 720,
      delay: Math.floor(rnd() * 120),
      duration: 900 + Math.floor(rnd() * 500),
    };
  });
}

/**
 * Explosive coin / star / confetti burst from the centre of its parent (which should be a
 * zero-size anchor). Particles fly outward, fall slightly under "gravity" and fade.
 */
export const ParticleBurst = memo(function ParticleBurst({
  count = 24,
  radius = 160,
  seed = 7,
  delay = 0,
}: {
  count?: number;
  radius?: number;
  seed?: number;
  delay?: number;
}) {
  const reducedMotion = useReducedMotion();
  const particles = useMemo(() => buildParticles(count, radius, seed), [count, radius, seed]);
  if (reducedMotion) return null;
  return (
    <>
      {particles.map((p, i) => (
        <Particle key={i} spec={p} delay={delay} />
      ))}
    </>
  );
});

function Particle({ spec, delay }: { spec: ParticleSpec; delay: number }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(
      delay + spec.delay,
      withTiming(1, { duration: spec.duration, easing: Easing.out(Easing.cubic) }),
    );
    return () => cancelAnimation(t);
  }, [t, delay, spec.delay, spec.duration]);

  const style = useAnimatedStyle(() => {
    const x = Math.cos(spec.angle) * spec.distance * t.value;
    // Upward-biased launch with a gravity term pulling particles back down.
    const y = Math.sin(spec.angle) * spec.distance * t.value - 40 * t.value + 90 * t.value * t.value;
    return {
      opacity: interpolate(t.value, [0, 0.08, 0.7, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: x - spec.size / 2 },
        { translateY: y - spec.size / 2 },
        { rotate: `${spec.spin * t.value}deg` },
        { scale: interpolate(t.value, [0, 0.15, 1], [0.3, 1.15, 0.8]) },
      ],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.particle, { width: spec.size, height: spec.size }, style]}>
      <ParticleShape kind={spec.kind} size={spec.size} color={spec.color} />
    </Animated.View>
  );
}

function ParticleShape({ kind, size, color }: { kind: ParticleKind; size: number; color: string }) {
  if (kind === 'coin') {
    return (
      <Svg width={size} height={size} viewBox="0 0 20 20">
        <Circle cx="10" cy="10" r="9.2" fill="#E89B00" />
        <Circle cx="10" cy="9.3" r="7.6" fill="#FFD23F" />
        <Circle cx="10" cy="9.3" r="4.8" fill="none" stroke="#E89B00" strokeWidth="1.4" />
        <Path d="M6.5 6.2 Q8 4.8 10 4.9" stroke="#FFF6C9" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      </Svg>
    );
  }
  if (kind === 'star') {
    return <Sparkle size={size} color={color === '#FFFFFF' ? '#FFE680' : color} />;
  }
  return <View style={{ width: size, height: size * 0.45, borderRadius: 2, backgroundColor: color }} />;
}

/** Four-point sparkle star. */
export function Sparkle({ size = 18, color = '#FFD23F' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z" fill={color} />
    </Svg>
  );
}

/** Slowly rotating golden light rays with a soft radial glow (jackpot background). */
export const Sunburst = memo(function Sunburst({
  size,
  rays = 14,
  color = '#FFD54A',
}: {
  size: number;
  rays?: number;
  color?: string;
}) {
  const reducedMotion = useReducedMotion();
  const rotation = useSharedValue(0);
  const appear = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) return;
    appear.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.back(1.6)) });
    rotation.value = withRepeat(withTiming(360, { duration: 14000, easing: Easing.linear }), -1, false);
    return () => {
      cancelAnimation(rotation);
      cancelAnimation(appear);
    };
  }, [reducedMotion, rotation, appear]);

  const style = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ rotate: `${rotation.value}deg` }, { scale: 0.4 + appear.value * 0.6 }],
  }));

  const rayPath = useMemo(() => {
    const c = 50;
    const half = Math.PI / rays / 2.2;
    let d = '';
    for (let i = 0; i < rays; i += 1) {
      const a = (i / rays) * Math.PI * 2;
      const x1 = c + Math.cos(a - half) * 50;
      const y1 = c + Math.sin(a - half) * 50;
      const x2 = c + Math.cos(a + half) * 50;
      const y2 = c + Math.sin(a + half) * 50;
      d += `M${c} ${c} L${x1.toFixed(2)} ${y1.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)} Z `;
    }
    return d;
  }, [rays]);

  return (
    <Animated.View
      pointerEvents="none"
      renderToHardwareTextureAndroid
      style={[{ width: size, height: size }, style]}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="sunburstFade" cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={color} stopOpacity="0.95" />
            <Stop offset="0.6" stopColor={color} stopOpacity="0.55" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Path d={rayPath} fill="url(#sunburstFade)" />
        <Circle cx="50" cy="50" r="22" fill="url(#sunburstFade)" />
      </Svg>
    </Animated.View>
  );
});

/**
 * Hero aura for the celebrating mascot: soft golden halo, two counter-rotating ray wheels,
 * expanding shockwave rings and sparkles orbiting around it.
 */
export const MascotAura = memo(function MascotAura({ size }: { size: number }) {
  const reducedMotion = useReducedMotion();
  const spin = useSharedValue(0);
  const breathe = useSharedValue(0);
  const appear = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) return;
    appear.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) });
    spin.value = withRepeat(withTiming(1, { duration: 16000, easing: Easing.linear }), -1, false);
    breathe.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => {
      cancelAnimation(spin);
      cancelAnimation(breathe);
      cancelAnimation(appear);
    };
  }, [reducedMotion, spin, breathe, appear]);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ scale: 0.6 + appear.value * 0.4 }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.8 + breathe.value * 0.2,
    transform: [{ scale: 0.94 + breathe.value * 0.08 }],
  }));
  const raysAStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));

  const raysA = useMemo(() => {
    const count = 12;
    const spread = 0.42;
    const inner = 12;
    let d = '';
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2;
      const h = (Math.PI / count) * spread;
      const p = (ang: number, r: number) =>
        `${(50 + Math.cos(ang) * r).toFixed(2)} ${(50 + Math.sin(ang) * r).toFixed(2)}`;
      d += `M${p(a - h * 0.25, inner)} L${p(a - h, 50)} L${p(a + h, 50)} L${p(a + h * 0.25, inner)} Z `;
    }
    return d;
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      renderToHardwareTextureAndroid
      style={[{ width: size, height: size }, rootStyle]}
    >
      {/* Warm halo */}
      <Animated.View style={[StyleSheet.absoluteFill, haloStyle]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="auraHalo" cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
              <Stop offset="0.25" stopColor="#FFF0A8" stopOpacity="0.9" />
              <Stop offset="0.55" stopColor="#FFC928" stopOpacity="0.45" />
              <Stop offset="1" stopColor="#FFB800" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="50" cy="50" r="50" fill="url(#auraHalo)" />
        </Svg>
      </Animated.View>

      {/* Radiant golden rays */}
      <Animated.View style={[StyleSheet.absoluteFill, raysAStyle]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="auraRayA" cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
              <Stop offset="0.2" stopColor="#FFE15A" stopOpacity="0.85" />
              <Stop offset="1" stopColor="#FFB800" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Path d={raysA} fill="url(#auraRayA)" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
});

/** A sparkle that pops in, twinkles (scale + rotate) forever. */
export function TwinkleSparkle({
  size = 18,
  color = '#FFD23F',
  delay = 0,
  style,
}: {
  size?: number;
  color?: string;
  delay?: number;
  style?: object;
}) {
  const reducedMotion = useReducedMotion();
  const t = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) return;
    t.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 380, easing: Easing.out(Easing.back(2)) }),
          withTiming(0.35, { duration: 520, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(t);
  }, [t, delay, reducedMotion]);

  const animated = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.35, 1], [0, 0.6, 1]),
    transform: [{ scale: t.value }, { rotate: `${t.value * 45}deg` }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute' }, style, animated]}>
      <Sparkle size={size} color={color} />
    </Animated.View>
  );
}

type RainPiece = {
  x: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
  sway: number;
  spin: number;
  round: boolean;
};

/** Gentle, never-ending confetti rain across its (absolute-fill) parent. */
export const ConfettiRain = memo(function ConfettiRain({
  width,
  height,
  count = 14,
  seed = 3,
}: {
  width: number;
  height: number;
  count?: number;
  seed?: number;
}) {
  const reducedMotion = useReducedMotion();
  const pieces = useMemo<RainPiece[]>(() => {
    const rnd = seeded(seed);
    return Array.from({ length: count }, () => ({
      x: rnd() * width,
      size: 6 + rnd() * 6,
      color: PALETTE[Math.floor(rnd() * (PALETTE.length - 1))],
      duration: 3200 + rnd() * 2600,
      delay: rnd() * 2600,
      sway: 10 + rnd() * 22,
      spin: 180 + rnd() * 360,
      round: rnd() < 0.3,
    }));
  }, [count, seed, width]);
  if (reducedMotion || !width || !height) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <RainDrop key={i} piece={p} height={height} />
      ))}
    </View>
  );
});

function RainDrop({ piece, height }: { piece: RainPiece; height: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      piece.delay,
      withRepeat(withTiming(1, { duration: piece.duration, easing: Easing.linear }), -1, false),
    );
    return () => cancelAnimation(t);
  }, [t, piece.delay, piece.duration]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.05, 0.8, 1], [0, 0.9, 0.9, 0]),
    transform: [
      { translateX: piece.x + Math.sin(t.value * Math.PI * 4) * piece.sway },
      { translateY: -20 + t.value * (height + 40) },
      { rotate: `${t.value * piece.spin}deg` },
      { scaleY: Math.cos(t.value * Math.PI * 6) },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          width: piece.size,
          height: piece.round ? piece.size : piece.size * 0.45,
          borderRadius: piece.round ? piece.size : 2,
          backgroundColor: piece.color,
        },
        style,
      ]}
    />
  );
}

/** Diagonal light streak sweeping across its parent every few seconds (shiny card / button). */
export function ShineSweep({
  every = 2600,
  delay = 400,
  opacity = 0.55,
  bandWidth = 70,
  radius = 0,
}: {
  every?: number;
  delay?: number;
  opacity?: number;
  bandWidth?: number;
  radius?: number;
}) {
  const reducedMotion = useReducedMotion();
  const [w, setW] = useState(0);
  const t = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion || !w) return;
    t.value = 0;
    t.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 750, easing: Easing.inOut(Easing.quad) }),
          withDelay(every, withTiming(0, { duration: 0 })),
        ),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(t);
  }, [t, w, every, delay, reducedMotion]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -bandWidth * 2 + t.value * (w + bandWidth * 4) }, { skewX: '-20deg' }],
  }));

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: radius }]}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
    >
      {w && !reducedMotion ? (
        <Animated.View style={[{ position: 'absolute', top: -20, bottom: -20, width: bandWidth }, style]}>
          <Svg width="100%" height="100%" viewBox="0 0 10 10" preserveAspectRatio="none">
            <Defs>
              <SvgLinearGradient id="shineBand" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
                <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={opacity} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
              </SvgLinearGradient>
            </Defs>
            <Rect x="0" y="0" width="10" height="10" fill="url(#shineBand)" />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Repeating soft "breathing" pulse value 0..1 for glows and CTA buttons. */
export function usePulse(duration = 900) {
  const reducedMotion = useReducedMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) return;
    v.value = withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(v);
  }, [v, duration, reducedMotion]);
  return v;
}

const styles = StyleSheet.create({
  particle: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center' },
});
