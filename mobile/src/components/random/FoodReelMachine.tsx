import { useEffect, useState } from 'react';
import { Image, Pressable, Text, type ImageSourcePropType, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  runOnJS,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

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

const WINDOWS = [
  { left: '12.3%', stop: 0 },
  { left: '38.1%', stop: 0 },
  { left: '63.7%', stop: 0 },
] as const;

const LEVER_MAX_ANGLE = 82;
const LEVER_TRIGGER_ANGLE = 46;
const LEVER_RETURN = { damping: 12, stiffness: 190, mass: 0.7 };

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
  const reducedMotion = useReducedMotion();
  const handle = useSharedValue(0);
  const pullStarted = useSharedValue(false);
  const bob = useSharedValue(0);

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
      bob.value = withSequence(
        withTiming(-3, { duration: 90 }),
        withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) }),
      );
      return;
    }

    bob.value = withRepeat(withTiming(-2, { duration: 420 }), -1, true);
    return () => {
      cancelAnimation(bob);
    };
  }, [running, finishing, reducedMotion, bob]);

  useEffect(() => {
    if (!running && !finishing) pullStarted.value = false;
  }, [running, finishing, pullStarted]);

  const tapLever = () => {
    if (running || finishing || pullStarted.value) return;
    pullStarted.value = true;
    cancelAnimation(handle);
    handle.value = withSequence(
      withTiming(LEVER_MAX_ANGLE, { duration: reducedMotion ? 0 : 160, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) runOnJS(onPull)();
      }),
      withDelay(90, withSpring(0, LEVER_RETURN)),
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
      handle.value = Math.max(0, Math.min(LEVER_MAX_ANGLE, event.translationY / travel * LEVER_MAX_ANGLE));
    })
    .onEnd(() => {
      if (handle.value >= LEVER_TRIGGER_ANGLE && !pullStarted.value) {
        pullStarted.value = true;
        handle.value = withSequence(
          withTiming(LEVER_MAX_ANGLE, { duration: 80 }, (finished) => {
            if (finished) runOnJS(onPull)();
          }),
          withDelay(90, withSpring(0, LEVER_RETURN)),
        );
      } else {
        handle.value = withSpring(0, LEVER_RETURN);
      }
    })
    .onFinalize(() => {
      if (!pullStarted.value) {
        handle.value = withSpring(0, LEVER_RETURN);
      }
    });

  useEffect(() => {
    if (!finishing || reducedMotion) return;
    const timers = [720, 1060, 1400].map((delay) =>
      setTimeout(() => {
        void Haptics.selectionAsync().catch(() => undefined);
      }, delay),
    );
    return () => timers.forEach(clearTimeout);
  }, [finishing, reducedMotion]);

  const handleStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-handle.value}deg` }] }));
  const bodyStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }] }));
  const itemHeight = (width / 1.5) * 0.52;

  return (
    <View style={styles.zone} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <>
          <Image source={SHADOW} resizeMode="stretch" style={styles.shadow} />
          <Animated.View style={[styles.bodyGroup, bodyStyle]}>
            {WINDOWS.map((window, index) => (
              <View key={index} style={[styles.window, { left: window.left }]}>
                <ReelTrack
                  items={
                    index === 1 && finishing && selectedDish
                      ? [selectedDish, REELS[1][1], REELS[1][2], REELS[1][3]]
                      : REELS[index]
                  }
                  itemHeight={itemHeight}
                  running={running}
                  finishing={finishing}
                  reducedMotion={reducedMotion}
                  stopIndex={window.stop}
                  stagger={index * 170}
                />
                <Image source={GLASS} resizeMode="stretch" style={styles.glass} />
              </View>
            ))}
            <Image source={BODY} resizeMode="stretch" style={styles.body} />
            {running ? (
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
        </>
      ) : null}
    </View>
  );
}

function ReelTrack({
  items,
  itemHeight,
  running,
  finishing,
  reducedMotion,
  stopIndex,
  stagger,
}: {
  items: ImageSourcePropType[];
  itemHeight: number;
  running: boolean;
  finishing: boolean;
  reducedMotion: boolean;
  stopIndex: number;
  stagger: number;
}) {
  const position = useSharedValue(0);

  useEffect(() => {
    if (!itemHeight) return;
    const cycle = itemHeight * items.length;
    if (!running) {
      cancelAnimation(position);
      position.value = -itemHeight * stopIndex;
      return;
    }
    if (reducedMotion) {
      position.value = -itemHeight * stopIndex;
      return;
    }

    if (finishing) {
      cancelAnimation(position);
      const destination = -cycle * 2 - itemHeight * stopIndex;
      position.value = withDelay(
        stagger,
        withSequence(
          withTiming(destination - 8, {
            duration: 600 + stagger,
            easing: Easing.out(Easing.cubic),
          }),
          withTiming(destination, { duration: 120, easing: Easing.out(Easing.quad) }),
        ),
      );
      return;
    }

    position.value = 0;
    position.value = withDelay(
      stagger,
      withRepeat(
        withTiming(-cycle, {
          duration: 560 + stagger * 0.2,
          easing: Easing.linear,
        }),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(position);
  }, [running, finishing, itemHeight, items.length, position, reducedMotion, stagger, stopIndex]);

  const trackStyle = useAnimatedStyle(() => ({ transform: [{ translateY: position.value }] }));
  const loopItems = [...items, ...items, ...items];

  return (
    <Animated.View style={trackStyle} importantForAccessibility="no-hide-descendants">
      {loopItems.map((source, index) => (
        <Image
          key={index}
          source={source}
          resizeMode="cover"
          style={{ width: '100%', height: itemHeight }}
        />
      ))}
    </Animated.View>
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
