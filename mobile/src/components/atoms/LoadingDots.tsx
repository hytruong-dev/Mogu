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

export function LoadingDots({ className }: Props) {
  const opacities = [useSharedValue(0.45), useSharedValue(0.45), useSharedValue(0.45)];

  useEffect(() => {
    opacities.forEach((opacity, index) => {
      opacity.value = withDelay(
        index * DOT_DELAY,
        withRepeat(
          withSequence(
            withTiming(1, { duration: DOT_DURATION, easing: Easing.out(Easing.quad) }),
            withTiming(0.45, { duration: DOT_DURATION, easing: Easing.in(Easing.quad) }),
          ),
          -1, // infinite
          false,
        ),
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View className={cn('flex-row gap-4', className)}>
      {opacities.map((opacity, index) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const animStyle = useAnimatedStyle(() => ({
          opacity: opacity.value,
          transform: [
            {
              scale: opacity.value * 0.26 + 0.82, // map [0.45,1] → [0.82,1.08] linearly
            },
          ],
        }));

        return (
          <Animated.View
            key={index}
            style={animStyle}
            className="w-[9px] h-[9px] rounded-full bg-[#FFC400]"
          />
        );
      })}
    </View>
  );
}
