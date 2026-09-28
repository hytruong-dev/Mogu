import { memo, useEffect, useState } from 'react';
import { Image, Pressable, type ImageSourcePropType, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  runOnJS,
  runOnUI,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { ParticleBurst } from './RewardEffects';

const BODY = require('../../assets/images/noan/food-reel/machine-body.png');
const HANDLE = require('../../assets/images/noan/food-reel/machine-handle.png');
const GLASS = require('../../assets/images/noan/food-reel/reel-glass-overlay.png');
const SHADOW = require('../../assets/images/noan/food-reel/machine-shadow.png');

const PHO = require('../../assets/images/noan/food-reel/dish-pho-v1.png');
const COM_TAM = require('../../assets/images/noan/food-reel/dish-com-tam-v1.png');
const BUN_RIEU = require('../../assets/images/noan/food-reel/dish-bun-rieu.png');
const BANH_CUON = require('../../assets/images/noan/food-reel/dish-banh-cuon-v1.png');
const CHAO_GA = require('../../assets/images/random/chao-ga.jpg');

const REELS: ImageSourcePropType[][] = [
  [PHO, BUN_RIEU, BANH_CUON, CHAO_GA],
  [COM_TAM, CHAO_GA, PHO, BUN_RIEU],
  [BANH_CUON, PHO, CHAO_GA, BUN_RIEU],
];

const WINDOWS = ['12.3%', '38.1%', '63.7%'] as const;
/** Centres of the five transparent bulb holes in machine-body.png (percent of the PNG). */
const BULBS = [30.7, 40.2, 49.9, 59.6, 69.3];

/**
 * Coin Master-style timing (ms after `finishing` turns true). Each reel lands at its time;
 * the last one crawls in slowly for suspense. Sounds/haptics use the same schedule.
 */
export const REEL_STOP_TIMES = [450, 820, 1380] as const;
/** How long the jackpot celebration plays inside the machine before the dish is revealed. */
export const JACKPOT_HOLD_MS = 450;
export const FOOD_REEL_REVEAL_DELAY = REEL_STOP_TIMES[2] + JACKPOT_HOLD_MS;

const LOOP_COPIES = 4;
/** Full-speed loop: one reel cycle every N ms. */
const SPIN_CYCLE_MS = 380;
const SPIN_UP_MS = 2 * SPIN_CYCLE_MS; // ease-in(quad) ends at full speed
const OVERSHOOT = 0.16; // of an item height

const LEVER_MAX_ANGLE = 82;
const LEVER_TRIGGER_ANGLE = 46;
const LEVER_RETURN = { damping: 7, stiffness: 170, mass: 0.7 };

type LightMode = 'idle' | 'spin' | 'win';

/** PNG layers stay fixed while each food track moves behind the transparent machine windows. */
export function FoodReelMachine({
  running,
  finishing,
  selectedDish,
  onPull,
}: {
  running: boolean;
  finishing: boolean;
  selectedDish?: ImageSourcePropType;
  onPull: () => void;
}) {
  const [width, setWidth] = useState(0);
  const [jackpot, setJackpot] = useState(false);
  const reducedMotion = useReducedMotion();
  const handle = useSharedValue(0);
  const pullStarted = useSharedValue(false);
  const bob = useSharedValue(0);
  const shake = useSharedValue(0);
  const pulse = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      bob.value = 0;
      return;
    }
    if (!running) {
      cancelAnimation(bob);
      bob.value = 0;
      return;
    }
    if (finishing) {
      cancelAnimation(bob);
      bob.value = withTiming(0, { duration: 200 });
      return;
    }
    // Machine rattles while the reels are at full speed.
    bob.value = withRepeat(
      withSequence(withTiming(-1.6, { duration: 45 }), withTiming(0.8, { duration: 45 })),
      -1,
      true,
    );
    return () => cancelAnimation(bob);
  }, [running, finishing, reducedMotion, bob]);

  useEffect(() => {
    if (!running && !finishing) pullStarted.value = false;
  }, [running, finishing, pullStarted]);

  // Reel-stop thumps + jackpot celebration.
  useEffect(() => {
    if (!finishing) {
      setJackpot(false);
      glow.value = 0;
      return;
    }
    if (reducedMotion) {
      const t = setTimeout(() => setJackpot(true), REEL_STOP_TIMES[2]);
      return () => clearTimeout(t);
    }
    const timers = REEL_STOP_TIMES.map((delay, index) =>
      setTimeout(() => {
        const strength = index === 2 ? 5 : 2.5;
        shake.value = withSequence(
          withTiming(strength, { duration: 40 }),
          withTiming(-strength * 0.7, { duration: 60 }),
          withTiming(strength * 0.35, { duration: 60 }),
          withTiming(0, { duration: 80 }),
        );
      }, delay),
    );
    timers.push(
      setTimeout(() => {
        setJackpot(true);
        pulse.value = withSequence(
          withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) }),
          withSpring(0, { damping: 6, stiffness: 180 }),
        );
        glow.value = withRepeat(withTiming(1, { duration: 260 }), -1, true);
      }, REEL_STOP_TIMES[2]),
    );
    return () => {
      timers.forEach(clearTimeout);
      cancelAnimation(glow);
    };
  }, [finishing, reducedMotion, shake, pulse, glow]);

  const fireLever = (duration: number) => {
    'worklet';
    handle.value = withSequence(
      withTiming(LEVER_MAX_ANGLE, { duration, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) runOnJS(onPull)();
      }),
      withDelay(110, withSpring(0, LEVER_RETURN)),
    );
  };

  const tapLever = () => {
    if (running || finishing || pullStarted.value) return;
    pullStarted.value = true;
    cancelAnimation(handle);
    // Small wind-up upwards before the yank, like a real slot arm.
    handle.value = withSequence(
      withTiming(-10, { duration: reducedMotion ? 0 : 110, easing: Easing.out(Easing.quad) }),
      withTiming(LEVER_MAX_ANGLE, { duration: reducedMotion ? 0 : 170, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) runOnJS(onPull)();
      }),
      withDelay(110, withSpring(0, LEVER_RETURN)),
    );
  };

  const pullGesture = Gesture.Pan()
    .enabled(!running && !finishing)
    .minDistance(4)
    .onStart(() => {
      cancelAnimation(handle);
    })
    .onUpdate((event) => {
      // A full pull travels about 20% of the machine width on any screen.
      const travel = Math.max(48, width * 0.2);
      handle.value = Math.max(0, Math.min(LEVER_MAX_ANGLE, (event.translationY / travel) * LEVER_MAX_ANGLE));
    })
    .onEnd(() => {
      if (handle.value >= LEVER_TRIGGER_ANGLE && !pullStarted.value) {
        pullStarted.value = true;
        fireLever(80);
      } else {
        handle.value = withSpring(0, LEVER_RETURN);
      }
    })
    .onFinalize(() => {
      if (!pullStarted.value) {
        handle.value = withSpring(0, LEVER_RETURN);
      }
    });

  const handleStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-handle.value}deg` }] }));
  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bob.value },
      { translateX: shake.value },
      { scale: 1 + pulse.value * 0.06 },
    ],
  }));
  const winFrameStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0.55, 1]),
    transform: [{ scale: interpolate(glow.value, [0, 1], [1, 1.04]) }],
  }));
  const itemHeight = (width / 1.5) * 0.52;
  const lightMode: LightMode = jackpot ? 'win' : running ? 'spin' : 'idle';

  return (
    <View style={styles.zone} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <>
          <Image source={SHADOW} resizeMode="stretch" style={styles.shadow} />
          <Animated.View style={[styles.bodyGroup, bodyStyle]}>
            <Bulbs mode={lightMode} reducedMotion={reducedMotion} />
            {WINDOWS.map((left, index) => (
              <View key={index} style={[styles.window, { left }]}>
                <ReelTrack
                  items={
                    selectedDish && (finishing || jackpot)
                      ? [selectedDish, REELS[index][1], REELS[index][2], REELS[index][3]]
                      : REELS[index]
                  }
                  selectedDish={selectedDish}
                  itemHeight={itemHeight}
                  machineWidth={width}
                  running={running}
                  finishing={finishing}
                  reducedMotion={reducedMotion}
                  reelIndex={index}
                />
                <Image source={GLASS} resizeMode="stretch" style={styles.glass} />
              </View>
            ))}
            <Image source={BODY} resizeMode="stretch" style={styles.body} />
            <BulbHalos mode={lightMode} reducedMotion={reducedMotion} />

            {jackpot ? (
              <Animated.View pointerEvents="none" style={[styles.winFrame, winFrameStyle]} />
            ) : null}

            {running && !finishing ? (
              <>
                <Svg style={styles.motionLeft} viewBox="0 0 22 68" pointerEvents="none">
                  <Path
                    d="M18 8 C7 20 7 47 18 60 M10 18 C4 28 4 40 10 50"
                    fill="none"
                    stroke="#FFB800"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </Svg>
                <Svg style={styles.motionRight} viewBox="0 0 22 68" pointerEvents="none">
                  <Path
                    d="M4 8 C15 20 15 47 4 60 M12 18 C18 28 18 40 12 50"
                    fill="none"
                    stroke="#FFB800"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </Svg>
              </>
            ) : null}
            <GestureDetector gesture={pullGesture}>
              <Animated.View style={styles.handleTouch}>
                <Pressable
                  style={styles.handlePressable}
                  onPress={tapLever}
                  disabled={running || finishing}
                  accessibilityRole="button"
                  accessibilityLabel="Kéo cần gạt xuống để chọn món"
                  accessibilityHint="Bạn cũng có thể chạm để bắt đầu quay"
                >
                  <Animated.Image
                    source={HANDLE}
                    resizeMode="contain"
                    style={[styles.handle, handleStyle]}
                  />
                </Pressable>
              </Animated.View>
            </GestureDetector>
          </Animated.View>
          {jackpot && !reducedMotion ? (
            <View pointerEvents="none" style={styles.burstAnchor}>
              <ParticleBurst count={22} radius={width * 0.62} />
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const Bulbs = memo(function Bulbs({ mode, reducedMotion }: { mode: LightMode; reducedMotion: boolean }) {
  const step = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    if (mode === 'win') {
      step.value = withRepeat(
        withSequence(withTiming(1, { duration: 110 }), withTiming(0, { duration: 110 })),
        -1,
        true,
      );
    } else if (mode === 'spin') {
      step.value = withRepeat(
        withTiming(5, { duration: 420, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      step.value = withRepeat(
        withSequence(withTiming(1, { duration: 520 }), withTiming(0, { duration: 520 })),
        -1,
        true,
      );
    }
    return () => cancelAnimation(step);
  }, [mode, reducedMotion, step]);

  return (
    <>
      {BULBS.map((x, index) => (
        <BulbView key={index} x={x} index={index} mode={mode} step={step} reducedMotion={reducedMotion} />
      ))}
    </>
  );
});

function BulbView({
  x,
  index,
  mode,
  step,
  reducedMotion,
}: {
  x: number;
  index: number;
  mode: LightMode;
  step: SharedValue<number>;
  reducedMotion: boolean;
}) {
  const animStyle = useAnimatedStyle(() => {
    if (reducedMotion) return { opacity: mode !== 'idle' ? 1 : 0.25 };
    if (mode === 'win') {
      return { opacity: step.value > 0.5 ? 1 : 0.2 };
    }
    if (mode === 'spin') {
      const activeIdx = Math.floor(step.value) % 5;
      return { opacity: activeIdx === index ? 1 : 0.25 };
    }
    return { opacity: (index % 2 === 0 ? step.value : 1 - step.value) > 0.5 ? 1 : 0.25 };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.bulb, { left: `${x - 2.2}%` }, styles.bulbOn, animStyle]}
    />
  );
}

const BulbHalos = memo(function BulbHalos({ mode, reducedMotion }: { mode: LightMode; reducedMotion: boolean }) {
  const step = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion || mode === 'idle') return;
    if (mode === 'win') {
      step.value = withRepeat(
        withSequence(withTiming(1, { duration: 110 }), withTiming(0, { duration: 110 })),
        -1,
        true,
      );
    } else {
      step.value = withRepeat(
        withTiming(5, { duration: 420, easing: Easing.linear }),
        -1,
        false,
      );
    }
    return () => cancelAnimation(step);
  }, [mode, reducedMotion, step]);

  if (mode === 'idle') return null;

  return (
    <>
      {BULBS.map((x, index) => (
        <BulbHaloView key={index} x={x} index={index} mode={mode} step={step} reducedMotion={reducedMotion} />
      ))}
    </>
  );
});

function BulbHaloView({
  x,
  index,
  mode,
  step,
  reducedMotion,
}: {
  x: number;
  index: number;
  mode: LightMode;
  step: SharedValue<number>;
  reducedMotion: boolean;
}) {
  const animStyle = useAnimatedStyle(() => {
    if (reducedMotion) return { opacity: 0.8 };
    if (mode === 'win') {
      return { opacity: step.value > 0.5 ? 0.9 : 0 };
    }
    const activeIdx = Math.floor(step.value) % 5;
    return { opacity: activeIdx === index ? 0.85 : 0 };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.halo, { left: `${x - 3.6}%` }, animStyle]}
    />
  );
}

function ReelTrack({
  items,
  selectedDish,
  itemHeight,
  machineWidth,
  running,
  finishing,
  reducedMotion,
  reelIndex,
}: {
  items: ImageSourcePropType[];
  selectedDish?: ImageSourcePropType;
  itemHeight: number;
  machineWidth: number;
  running: boolean;
  finishing: boolean;
  reducedMotion: boolean;
  reelIndex: number;
}) {
  const position = useSharedValue(0);
  /** 0 = crisp & still, 1 = full-speed motion blur. */
  const speed = useSharedValue(0);
  const startDelay = reelIndex * 90;

  useEffect(() => {
    if (!itemHeight) return;
    const cycle = itemHeight * items.length;

    if (!running) {
      cancelAnimation(position);
      cancelAnimation(speed);
      position.value = 0;
      speed.value = 0;
      return;
    }
    if (reducedMotion) {
      position.value = 0;
      return;
    }

    if (finishing) {
      const duration = REEL_STOP_TIMES[reelIndex];
      const isLast = reelIndex === 2;
      // All reels land on items[0] (the selected dish from API)
      const snap = cycle;
      runOnUI(() => {
        'worklet';
        cancelAnimation(position);
        // Keep the current visual position but fold it back into the first cycle.
        const current = -(-position.value % cycle);
        position.value = current;
        // out-cubic starts at 3x average speed; out-quint (last reel, suspense) at 5x,
        // so the hand-off from the constant-speed loop feels seamless.
        const velocity = cycle / SPIN_CYCLE_MS;
        const travel = (velocity * duration) / (isLast ? 5 : 3);
        const destination = -Math.ceil((-current + travel) / snap) * snap;
        position.value = withSequence(
          withTiming(destination - itemHeight * OVERSHOOT, {
            duration,
            easing: isLast ? Easing.out(Easing.poly(5)) : Easing.out(Easing.cubic),
          }),
          withSpring(destination, { damping: 7, stiffness: 260, mass: 0.6 }),
        );
      })();
      speed.value = withTiming(0, { duration: duration * 0.85, easing: Easing.in(Easing.quad) });
      return;
    }

    // Anticipation: kick the reel back a little, then accelerate hard into the loop.
    // Start one cycle down (looks identical) so the kick-back never reveals an empty gap.
    position.value = -cycle;
    speed.value = withDelay(startDelay + 140, withTiming(1, { duration: SPIN_UP_MS }));
    position.value = withDelay(
      startDelay,
      withSequence(
        withTiming(-cycle + itemHeight * 0.22, { duration: 140, easing: Easing.out(Easing.quad) }),
        withTiming(-2 * cycle, { duration: SPIN_UP_MS, easing: Easing.in(Easing.quad) }),
        withRepeat(withTiming(-3 * cycle, { duration: SPIN_CYCLE_MS, easing: Easing.linear }), -1, false),
      ),
    );
    return () => {
      cancelAnimation(position);
      cancelAnimation(speed);
    };
  }, [running, finishing, itemHeight, items.length, position, speed, reducedMotion, reelIndex, startDelay]);

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: position.value }],
  }));
  const blurStyle = useAnimatedStyle(() => ({ opacity: speed.value }));
  const loopItems = Array.from({ length: LOOP_COPIES }, () => items).flat();

  return (
    <>
      <Animated.View style={trackStyle} importantForAccessibility="no-hide-descendants">
        {loopItems.map((source, index) => (
          <ReelItem
            key={index}
            source={source}
            itemHeight={itemHeight}
            machineWidth={machineWidth}
            reelIndex={reelIndex}
            isWinningDish={Boolean(selectedDish && source === selectedDish)}
          />
        ))}
      </Animated.View>
      {/* Motion-blur streaks + cylinder shading while the reel is at speed. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, blurStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={`reelShade${reelIndex}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#3C2415" stopOpacity="0.75" />
              <Stop offset="0.28" stopColor="#FFFFFF" stopOpacity="0.18" />
              <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.32" />
              <Stop offset="0.72" stopColor="#FFFFFF" stopOpacity="0.18" />
              <Stop offset="1" stopColor="#3C2415" stopOpacity="0.75" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill={`url(#reelShade${reelIndex})`} />
          {[14, 31, 50, 67, 84].map((x, i) => (
            <Rect key={i} x={x} y="0" width={i % 2 ? 3 : 5} height="100" fill="#FFFFFF" opacity={0.22} />
          ))}
        </Svg>
      </Animated.View>
    </>
  );
}

function ReelItem({
  source,
  itemHeight,
  machineWidth,
  reelIndex,
  isWinningDish,
}: {
  source: ImageSourcePropType;
  itemHeight: number;
  machineWidth: number;
  reelIndex: number;
  isWinningDish: boolean;
}) {
  if (isWinningDish && machineWidth > 0) {
    // Span the 3 windows seamlessly so the full dish photo from API is shown across the reels
    const panWidth = machineWidth * 0.754;
    const offsets = [0, -0.258 * machineWidth, -0.514 * machineWidth];
    const leftOffset = offsets[reelIndex] ?? 0;
    return (
      <View style={{ width: '100%', height: itemHeight, overflow: 'hidden', position: 'relative' }}>
        <Image
          source={source}
          resizeMode="cover"
          style={{
            position: 'absolute',
            left: leftOffset,
            top: 0,
            width: panWidth,
            height: itemHeight,
          }}
        />
      </View>
    );
  }

  return (
    <Image
      source={source}
      resizeMode="cover"
      style={{ width: '100%', height: itemHeight }}
    />
  );
}

const styles = StyleSheet.create({
  zone: { aspectRatio: 1.5, marginHorizontal: -28, marginTop: -2 },
  shadow: {
    position: 'absolute',
    bottom: -7,
    left: '7%',
    width: '86%',
    height: '18%',
  },
  bodyGroup: { ...StyleSheet.absoluteFill },
  body: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  window: {
    position: 'absolute',
    top: '23%',
    width: '24%',
    height: '52%',
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#FFF9EE',
  },
  glass: { ...StyleSheet.absoluteFill, width: '100%', height: '100%', opacity: 0.19 },
  bulb: {
    position: 'absolute',
    top: '11.6%',
    width: '4.4%',
    height: '6.6%',
    borderRadius: 999,
  },
  bulbOn: { backgroundColor: '#FFF6C2' },
  bulbOff: { backgroundColor: '#9C6A22' },
  halo: {
    position: 'absolute',
    top: '9.6%',
    width: '7.2%',
    height: '10.8%',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 236, 140, 0.45)',
  },
  winFrame: {
    position: 'absolute',
    top: '21%',
    left: '10.5%',
    width: '79%',
    height: '56%',
    borderRadius: 18,
    borderWidth: 3.5,
    borderColor: '#FFE24A',
    shadowColor: '#FFC800',
    shadowOpacity: 0.95,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  burstAnchor: {
    position: 'absolute',
    left: '50%',
    top: '49%',
    width: 0,
    height: 0,
  },
  handleTouch: {
    position: 'absolute',
    right: '-4%',
    top: '14%',
    width: '18%',
    height: '48%',
  },
  handlePressable: { width: '100%', height: '100%' },
  handle: {
    width: '100%',
    height: '100%',
    transformOrigin: ['50%', '78%', 0],
  },
  motionLeft: { position: 'absolute', left: '-1%', top: '30%', width: '7%', height: '32%' },
  motionRight: { position: 'absolute', right: '0%', top: '30%', width: '7%', height: '32%' },
});
