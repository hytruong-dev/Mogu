import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

type Props = {
  opacity: SharedValue<number>;
  glowScale: SharedValue<number>;
};

export function SplashBackground({ opacity, glowScale }: Props) {
  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: '#FFF9E8' }, containerStyle]}
    >
      <Animated.View
        style={[
          glowStyle,
          {
            position: 'absolute',
            top: '21%',
            left: '-20%',
            width: '140%',
            aspectRatio: 1,
            borderRadius: 9999,
            backgroundColor: 'rgba(255, 213, 79, 0.11)',
          },
        ]}
      />
      <Animated.View
        style={[
          glowStyle,
          {
            position: 'absolute',
            top: '29%',
            left: '3%',
            width: '94%',
            aspectRatio: 1,
            borderRadius: 9999,
            backgroundColor: 'rgba(255, 224, 91, 0.18)',
          },
        ]}
      />
    </Animated.View>
  );
}
