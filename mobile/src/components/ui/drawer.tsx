/**
 * Drawer — shadcn/ui Drawer pattern cho React Native
 *
 * Tái hiện đúng UX của vaul (shadcn Drawer):
 *  - Trượt lên từ dưới với spring animation
 *  - Drag handle có thể kéo xuống để đóng (react-native-gesture-handler)
 *  - Overlay mờ fade in/out
 *  - Scale-down content phía sau khi mở (vaul signature effect)
 *  - Snap points (optional)
 */
import * as React from 'react';
import { Modal, Pressable, Text, View, type ViewProps } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cn } from '../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DrawerProps {
  /** Điều khiển hiển thị từ bên ngoài */
  open: boolean;
  /** Gọi khi user muốn đóng */
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
  /** Chiều cao cố định của drawer (mặc định: tự co theo content) */
  snapHeight?: number;
  /** Ngưỡng kéo để đóng: kéo > X px thì dismiss (mặc định: 80) */
  dismissThreshold?: number;
  /** Class cho drawer container */
  className?: string;
  /** Màu nền của sheet (mặc định #FFFDF7) */
  sheetBackgroundColor?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SPRING_CONFIG = {
  damping: 30,
  stiffness: 300,
  mass: 0.9,
  overshootClamping: false,
} as const;

const CLOSE_TIMING = {
  duration: 280,
  easing: Easing.bezier(0.32, 0, 0.67, 0),
} as const;

// ─── Drawer Root ─────────────────────────────────────────────────────────────

export function Drawer({
  open,
  onOpenChange,
  children,
  snapHeight = 500,
  dismissThreshold = 80,
  className,
  sheetBackgroundColor = '#FFFDF7',
}: DrawerProps) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = React.useState(false);

  // Animation values
  const translateY = useSharedValue(snapHeight);
  const overlayOpacity = useSharedValue(0);
  const dragOffset = useSharedValue(0);

  // Mount/unmount với delay để animation hoạt động
  React.useEffect(() => {
    if (open) {
      translateY.value = snapHeight;
      setMounted(true);
    }
  }, [open, snapHeight, translateY]);

  React.useEffect(() => {
    if (!mounted) return;
    if (open) {
      overlayOpacity.value = withTiming(1, { duration: 250 });
      translateY.value = withSpring(0, SPRING_CONFIG);
    } else {
      overlayOpacity.value = withTiming(0, { duration: 220 });
      translateY.value = withTiming(snapHeight, CLOSE_TIMING, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [open, mounted, snapHeight, translateY, overlayOpacity]);

  const close = React.useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  // ── Drag gesture để kéo đóng ─────────────────────────────────────────────
  const panGesture = Gesture.Pan()
    .activeOffsetY([0, 8]) // chỉ kích hoạt khi kéo xuống
    .onUpdate((e) => {
      const dy = Math.max(0, e.translationY); // chỉ cho kéo xuống
      dragOffset.value = dy;
      translateY.value = dy;
      // Fade overlay theo drag
      const progress = 1 - dy / snapHeight;
      overlayOpacity.value = Math.max(0, progress);
    })
    .onEnd((e) => {
      if (e.translationY > dismissThreshold || e.velocityY > 500) {
        // Dismiss
        overlayOpacity.value = withTiming(0, { duration: 180 });
        translateY.value = withTiming(snapHeight, CLOSE_TIMING, (finished) => {
          if (finished) {
            dragOffset.value = 0;
            runOnJS(close)();
          }
        });
      } else {
        // Snap back
        translateY.value = withSpring(0, SPRING_CONFIG);
        overlayOpacity.value = withTiming(1, { duration: 150 });
        dragOffset.value = 0;
      }
    });

  // ── Animated styles ───────────────────────────────────────────────────────
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={close}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          {/* Overlay */}
          <Animated.View
            style={[
              overlayStyle,
              {
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.46)',
              },
            ]}
          >
            <Pressable style={{ flex: 1 }} onPress={close} />
          </Animated.View>

          {/* Sheet */}
          <Animated.View
            style={[
              sheetStyle,
              {
                height: snapHeight,
                maxHeight: '92%',
                backgroundColor: sheetBackgroundColor,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                paddingBottom: insets.bottom,
                overflow: 'hidden',
                // Vaul shadow
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.12,
                shadowRadius: 24,
                elevation: 24,
              },
            ]}
            className={className}
          >
            {/* Drag handle — kéo để đóng */}
            <GestureDetector gesture={panGesture}>
              <View
                style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 10 }}
                accessible
                accessibilityLabel="Kéo để đóng"
              >
                <View
                  style={{
                    width: 44,
                    height: 4.5,
                    borderRadius: 100,
                    backgroundColor: '#D1D5DB',
                  }}
                />
              </View>
            </GestureDetector>

            {children}
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

// ─── Sub-components (theo pattern shadcn/ui) ─────────────────────────────────

export function DrawerHeader({
  children,
  className,
  ...props
}: ViewProps & { className?: string }) {
  return (
    <View {...props} className={cn('px-5 pb-2', className)}>
      {children}
    </View>
  );
}

export function DrawerTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Text
      className={cn('text-[18px] font-bold text-[#111]', className)}
      style={{ letterSpacing: -0.3 }}
    >
      {children}
    </Text>
  );
}

export function DrawerDescription({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Text
      className={cn('text-[13px] text-[#888] mt-1', className)}
      style={{ lineHeight: 18 }}
    >
      {children}
    </Text>
  );
}

export function DrawerContent({
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

export function DrawerFooter({
  children,
  className,
  ...props
}: ViewProps & { className?: string }) {
  return (
    <View {...props} className={cn('px-5 pb-4 gap-2', className)}>
      {children}
    </View>
  );
}

export function DrawerClose({
  onPress,
  className,
}: {
  onPress: () => void;
  className?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      className={cn(
        'w-8 h-8 rounded-full bg-[#F4F4F4] items-center justify-center',
        className,
      )}
      style={({ pressed }) => [pressed && { opacity: 0.7 }]}
    >
      <Text style={{ fontSize: 14, color: '#555', lineHeight: 16 }}>✕</Text>
    </Pressable>
  );
}
