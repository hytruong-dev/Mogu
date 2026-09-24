import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  Bell,
  Gift,
  Heart,
  MessageCircle,
  Trophy,
  UserPlus,
  X,
  Zap,
} from 'lucide-react-native';
import { notificationRealtime } from '../../services/notification-realtime';
import type { NotificationItem } from '../../services/api/types';

type Props = {
  onPressNotification?: (notif: NotificationItem) => void;
};

const TYPE_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; bg: string; label: string }
> = {
  SYSTEM: { icon: Zap, color: '#4F46E5', bg: '#EEF2FF', label: 'Hệ thống' },
  PROMO: { icon: Gift, color: '#EA580C', bg: '#FFF7ED', label: 'Khuyến mãi' },
  REMINDER: { icon: Bell, color: '#D97706', bg: '#FFFBEB', label: 'Nhắc nhở' },
  ACHIEVEMENT: { icon: Trophy, color: '#16A34A', bg: '#F0FDF4', label: 'Thành tích' },
  SOCIAL_LIKE: { icon: Heart, color: '#DC2626', bg: '#FEF2F2', label: 'Thích' },
  SOCIAL_COMMENT: { icon: MessageCircle, color: '#2563EB', bg: '#EFF6FF', label: 'Bình luận' },
  SOCIAL_FOLLOW: { icon: UserPlus, color: '#7C3AED', bg: '#F5F3FF', label: 'Theo dõi' },
  SOCIAL_REPLY: { icon: MessageCircle, color: '#0284C7', bg: '#F0F9FF', label: 'Trả lời' },
};

export function InAppNotificationBanner({ onPressNotification }: Props) {
  const insets = useSafeAreaInsets();
  const [currentNotif, setCurrentNotif] = useState<NotificationItem | null>(null);
  const translateY = useRef(new Animated.Value(-160)).current;
  const dismissTimerRef = useRef<any>(null);

  const dismiss = () => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    Animated.timing(translateY, {
      toValue: -160,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setCurrentNotif(null);
    });
  };

  const show = (notif: NotificationItem) => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
    }

    setCurrentNotif(notif);
    translateY.setValue(-160);

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      // ignore
    }

    Animated.spring(translateY, {
      toValue: 0,
      damping: 18,
      stiffness: 160,
      mass: 0.8,
      useNativeDriver: true,
    }).start();

    // Auto dismiss after 5 seconds
    dismissTimerRef.current = setTimeout(() => {
      dismiss();
    }, 5000);
  };

  useEffect(() => {
    const unsubscribe = notificationRealtime.subscribeToNewNotifications((notif) => {
      show(notif);
    });
    return () => {
      unsubscribe();
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy < 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -20 || gestureState.vy < -0.5) {
          dismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  if (!currentNotif) return null;

  const meta = TYPE_CONFIG[currentNotif.type] || TYPE_CONFIG.SYSTEM;
  const Icon = meta.icon;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.container,
        {
          top: insets.top + 8,
          transform: [{ translateY }],
        },
      ]}
    >
      <Pressable
        style={styles.card}
        onPress={() => {
          dismiss();
          onPressNotification?.(currentNotif);
        }}
      >
        <View style={[styles.iconWrapper, { backgroundColor: meta.bg }]}>
          <Icon size={20} color={meta.color} />
        </View>

        <View style={styles.textContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.badgeText}>{meta.label}</Text>
            <Text style={styles.timeText}>Vừa xong</Text>
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {currentNotif.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {currentNotif.body}
          </Text>
        </View>

        <Pressable
          style={styles.closeBtn}
          onPress={(e) => {
            e.stopPropagation();
            dismiss();
          }}
          hitSlop={10}
        >
          <X size={16} color="#9CA3AF" />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 99999,
    elevation: 99999,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  iconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    paddingRight: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  body: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 16,
  },
  closeBtn: {
    padding: 6,
    marginLeft: 4,
  },
});
