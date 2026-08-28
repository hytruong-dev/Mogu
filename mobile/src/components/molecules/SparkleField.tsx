import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

type Props = {
  opacity?: SharedValue<number>;
  width: number;
  height: number;
};

const stars = [
  { left: 0.23, top: 0.185, size: 17, color: '#FFC400' },
  { left: 0.18, top: 0.235, size: 8, color: '#111111' },
  { left: 0.75, top: 0.18, size: 6, color: '#FFC400', round: true },
  { left: 0.85, top: 0.4, size: 8, color: '#FFC400' },
  { left: 0.14, top: 0.475, size: 8, color: '#FFC400' },
];

export function SparkleField({ opacity, width, height }: Props) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity ? opacity.value : 1,
  }));

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, animStyle]}>
      {stars.map((star, i) => (
        <View
          key={i}
          style={[
            styles.star,
            {
              left: width * star.left,
              top: height * star.top,
              width: star.size,
              height: star.size,
              backgroundColor: star.color,
              borderRadius: star.round ? star.size : 1,
              transform: star.round ? [] : [{ rotate: '45deg' }],
            },
          ]}
        />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({ star: { position: 'absolute' } });
