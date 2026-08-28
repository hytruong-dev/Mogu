import * as React from 'react';
import { Modal, Pressable, View, type ViewProps } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { cn } from '../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  className?: string;
  /** Height của sheet (default: auto từ content) */
  snapHeight?: number;
  /** Có hiện overlay mờ đen không (default: true) */
  overlay?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BottomSheet({
  visible,
  onClose,
  children,
  className,
  snapHeight = 480,
  overlay = true,
}: BottomSheetProps) {
  const translateY = useSharedValue(snapHeight);
  const overlayOpacity = useSharedValue(0);

  React.useEffect(() => {
    if (visible) {
      overlayOpacity.value = withTiming(1, { duration: 220 });
      translateY.value = withSpring(0, {
        damping: 28,
        stiffness: 280,
        mass: 0.8,
      });
    } else {
      overlayOpacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(
        snapHeight,
        { duration: 260, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(onClose)();
        },
      );
    }
  }, [visible, snapHeight, translateY, overlayOpacity, onClose]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        {overlay && (
          <Animated.View
            style={[overlayStyle, { ...StyleSheet_absoluteFill }]}
            className="absolute inset-0 bg-black/50"
            pointerEvents="box-none"
          >
            <Pressable className="flex-1" onPress={onClose} />
          </Animated.View>
        )}

        <Animated.View
          style={sheetStyle}
          className={cn('bg-white rounded-t-3xl overflow-hidden', className)}
        >
          {/* Handle bar */}
          <View className="items-center pt-3 pb-1">
            <View className="w-10 h-1 bg-gray-300 rounded-full" />
          </View>

          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

export function BottomSheetHeader({
  children,
  className,
  ...props
}: ViewProps & { className?: string }) {
  return (
    <View {...props} className={cn('flex-row items-center justify-between px-5 pb-3', className)}>
      {children}
    </View>
  );
}

export function BottomSheetContent({
  children,
  className,
  ...props
}: ViewProps & { className?: string }) {
  return (
    <View {...props} className={cn('px-5 pb-6', className)}>
      {children}
    </View>
  );
}

// Helper vì không import StyleSheet
const StyleSheet_absoluteFill = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};
