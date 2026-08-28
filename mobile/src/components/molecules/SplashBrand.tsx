import { View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

type Props = {
  mascotSize: number;
  wordmarkWidth: number;
  mascotOpacity: SharedValue<number>;
  mascotScale: SharedValue<number>;
  logoOpacity: SharedValue<number>;
  logoY: SharedValue<number>;
};

export function SplashBrand({
  mascotSize,
  wordmarkWidth,
  mascotOpacity,
  mascotScale,
  logoOpacity,
  logoY,
}: Props) {
  const mascotStyle = useAnimatedStyle(() => ({
    opacity: mascotOpacity.value,
    transform: [{ scale: mascotScale.value }],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ translateY: logoY.value }],
  }));

  return (
    <View className="items-center">
      {/* Mascot crop */}
      <Animated.View
        style={[
          mascotStyle,
          {
            width: mascotSize,
            height: mascotSize * 0.61,
            overflow: 'hidden',
          },
        ]}
      >
        <Animated.Image
          source={require('../../assets/images/logo/logo.png')}
          resizeMode="contain"
          style={{
            position: 'absolute',
            width: mascotSize,
            height: mascotSize,
            top: -mascotSize * 0.035,
          }}
        />
      </Animated.View>

      {/* Wordmark crop */}
      <Animated.View
        style={[
          logoStyle,
          {
            width: wordmarkWidth,
            height: wordmarkWidth * 0.326,
            overflow: 'hidden',
            marginTop: 2,
          },
        ]}
      >
        <Animated.Image
          source={require('../../assets/images/logo/mogu-wordmark.png')}
          resizeMode="contain"
          style={{
            position: 'absolute',
            width: wordmarkWidth,
            height: wordmarkWidth * (1040 / 1508),
            top: -wordmarkWidth * 0.156,
          }}
        />
      </Animated.View>
    </View>
  );
}
