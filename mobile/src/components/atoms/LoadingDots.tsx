import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { cn } from '../../lib/utils';

type Props = {
  className?: string;
};

const DOT_DELAY = 140;
const DOT_DURATION = 280;

function Dot({ index }: { index: number }) {
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    opacity.value = withDelay(
      index * DOT_DELAY,
      withRepeat(
        withSequence(
          withTiming(1, { duration: DOT_DURATION, easing: Easing.out(Easing.quad) }),
          withTiming(0.45, { duration: DOT_DURATION, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
  }, [index, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: opacity.value * 0.26 + 0.82 }],
  }));

  return (
    <Animated.View
      style={animStyle}
      className="w-[9px] h-[9px] rounded-full bg-primary"
    />
  );
}

export function LoadingDots({ className }: Props) {
  return (
    <View className={cn('flex-row gap-4', className)}>
      <Dot index={0} />
      <Dot index={1} />
      <Dot index={2} />
    </View>
  );
}
