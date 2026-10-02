import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  StyleSheet,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';

export type TransitionDirection = 'right' | 'bottom' | 'fade';

/** Đường cong kiểu iOS: vào nhanh, dừng êm. */
const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_IN = Easing.bezier(0.4, 0, 0.9, 0.4);

interface ScreenSlideTransitionProps {
  children: React.ReactNode;
  visible?: boolean;
  direction?: TransitionDirection;
  onBack?: () => void;
  style?: ViewStyle;
  duration?: number;
}

/**
 * ScreenSlideTransition — Push / Pop overlay (native driver, 60–120fps).
 * - right: trượt từ phải + bóng đổ cạnh trái, không nhấp nháy opacity.
 * - bottom: trượt lên + mờ dần, kiểu sheet toàn màn.
 * - fade: fade + scale nhẹ.
 * Hỗ trợ nút back phần cứng Android (chạy animation thoát trước khi gọi onBack).
 */
export function ScreenSlideTransition({
  children,
  visible = true,
  direction = 'right',
  onBack,
  style,
  duration = 320,
}: ScreenSlideTransitionProps) {
  const { width, height } = useWindowDimensions();
  const [shouldRender, setShouldRender] = useState(visible);
  const anim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const exiting = useRef(false);

  useEffect(() => {
    if (!visible || !onBack) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (exiting.current) return true;
      exiting.current = true;
      Animated.timing(anim, {
        toValue: 0,
        duration: duration * 0.75,
        easing: EASE_IN,
        useNativeDriver: true,
      }).start(() => {
        exiting.current = false;
        onBack();
      });
      return true;
    });
    return () => sub.remove();
  }, [visible, onBack, anim, duration]);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      anim.stopAnimation();
      Animated.timing(anim, {
        toValue: 1,
        duration,
        easing: EASE_OUT,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(anim, {
        toValue: 0,
        duration: duration * 0.75,
        easing: EASE_IN,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setShouldRender(false);
      });
    }
  }, [visible, duration, anim]);

  if (!shouldRender) return null;

  const animatedStyle =
    direction === 'right'
      ? {
          transform: [
            { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [width, 0] }) },
          ],
        }
      : direction === 'bottom'
        ? {
            opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1] }),
            transform: [
              { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [height * 0.35, 0] }) },
            ],
          }
        : {
            opacity: anim,
            transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }],
          };

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 50 }]} pointerEvents="box-none">
      {/* Lớp mờ phía sau tạo chiều sâu khi push */}
      {direction !== 'fade' ? (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: '#2A1A05',
              opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.18] }),
            },
          ]}
        />
      ) : null}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: '#FFF9E8' },
          direction === 'right' ? s.edgeShadow : null,
          animatedStyle,
          style,
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

/**
 * PageTransition — chuyển giữa các "trang" trong cùng một flow (key đổi → animate).
 * direction 1 = tiến (trượt từ phải), -1 = lùi (trượt từ trái).
 */
export function PageTransition({
  pageKey,
  direction = 1,
  children,
  duration = 300,
}: {
  pageKey: string;
  direction?: 1 | -1;
  children: React.ReactNode;
  duration?: number;
}) {
  const { width } = useWindowDimensions();
  const anim = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration,
      easing: EASE_OUT,
      useNativeDriver: true,
    }).start();
  }, [pageKey, anim, duration]);

  return (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: '#FFF9E8',
        opacity: anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.9, 1] }),
        transform: [
          {
            translateX: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [direction * width * 0.28, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

/**
 * ScreenFadeTransition — đổi tab chính: fade + trượt lên rất nhẹ.
 */
export function ScreenFadeTransition({
  children,
  style,
  duration = 260,
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
      easing: EASE_OUT,
      useNativeDriver: true,
    }).start();
  }, [anim, duration]);

  return (
    <Animated.View
      style={[
        { flex: 1 },
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  edgeShadow: {
    shadowColor: '#000',
    shadowOffset: { width: -6, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
  },
});
