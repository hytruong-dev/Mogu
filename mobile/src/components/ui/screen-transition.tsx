import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  Easing,
  StyleSheet,
  ViewStyle,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export type TransitionDirection = 'right' | 'bottom' | 'fade';

interface ScreenSlideTransitionProps {
  children: React.ReactNode;
  visible?: boolean;
  direction?: TransitionDirection;
  onBack?: () => void;
  style?: ViewStyle;
  duration?: number;
}

/**
 * ScreenSlideTransition — Hiệu ứng chuyển cảnh mượt mà giữa các màn hình (Push / Pop)
 * Hoạt động hoàn toàn trên native driver (60-120fps), hỗ trợ Android hardware back press.
 */
export function ScreenSlideTransition({
  children,
  visible = true,
  direction = 'right',
  onBack,
  style,
  duration = 240,
}: ScreenSlideTransitionProps) {
  const [shouldRender, setShouldRender] = useState(visible);
  const anim = useRef(new Animated.Value(visible ? 1 : 0)).current;

  // Handle hardware back on Android to trigger exit animation
  useEffect(() => {
    if (!visible || !onBack) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleExit();
      return true;
    });
    return () => sub.remove();
  }, [visible, onBack]);

  const handleExit = () => {
    Animated.timing(anim, {
      toValue: 0,
      duration: duration * 0.85,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      if (onBack) onBack();
    });
  };

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.timing(anim, {
        toValue: 1,
        duration,
        easing: Easing.bezier(0.22, 1, 0.36, 1), // smooth ease-out curve
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(anim, {
        toValue: 0,
        duration: duration * 0.8,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setShouldRender(false);
        }
      });
    }
  }, [visible, duration, anim]);

  if (!shouldRender) return null;

  const animatedStyle =
    direction === 'right'
      ? {
          opacity: anim.interpolate({
            inputRange: [0, 0.3, 1],
            outputRange: [0.3, 0.8, 1],
          }),
          transform: [
            {
              translateX: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [SCREEN_WIDTH, 0],
              }),
            },
          ],
        }
      : direction === 'bottom'
        ? {
            opacity: anim.interpolate({
              inputRange: [0, 0.4, 1],
              outputRange: [0.5, 0.9, 1],
            }),
            transform: [
              {
                translateY: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [SCREEN_HEIGHT * 0.75, 0],
                }),
              },
            ],
          }
        : {
            opacity: anim,
            transform: [
              {
                scale: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.97, 1],
                }),
              },
            ],
          };

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: '#FFF9E8', zIndex: 50 },
        animatedStyle,
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * ScreenFadeTransition — Hiệu ứng fade in nhẹ nhàng khi đổi tab chính
 */
export function ScreenFadeTransition({
  children,
  style,
  duration = 200,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  duration?: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [anim, duration]);

  return (
    <Animated.View
      style={[
        { flex: 1 },
        {
          opacity: anim,
          transform: [
            {
              scale: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.985, 1],
              }),
            },
          ],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
