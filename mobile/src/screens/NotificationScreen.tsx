import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Bell, Gift, Megaphone, Trophy, Zap } from 'lucide-react-native';
import { homeApi } from '../services/api/home';
import type { NotificationItem } from '../services/api/types';

type Props = {
  onBack: () => void;
};

const TYPE_META: Record<
  NotificationItem['type'],
  { icon: React.ElementType; color: string; bg: string; label: string }
> = {
  SYSTEM: { icon: Zap, color: '#5B6EF5', bg: '#EEF0FE', label: 'Hệ thống' },
  PROMO: { icon: Gift, color: '#E85E2F', bg: '#FDEEE9', label: 'Khuyến mãi' },
  REMINDER: { icon: Bell, color: '#FFC51A', bg: '#FFF8E0', label: 'Nhắc nhở' },
  ACHIEVEMENT: { icon: Trophy, color: '#22C55E', bg: '#E8FAF0', label: 'Thành tích' },
};

export function NotificationScreen({ onBack }: Props) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchNotifications = useCallback(async (p = 1, replace = true) => {
    try {
      const result = await homeApi.getNotifications({ page: p, limit: 20 });
      const items = result.data ?? [];
      setNotifications((prev) => (replace ? items : [...prev, ...items]));
      setHasMore(result.hasMore);
      setPage(p);
    } catch {
      // giữ data cũ
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(1, true);
  }, [fetchNotifications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications(1, true);
  }, [fetchNotifications]);

  const onLoadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    fetchNotifications(page + 1, false);
  }, [hasMore, loadingMore, page, fetchNotifications]);

  const handleMarkRead = useCallback(async (notif: NotificationItem) => {
    if (notif.status === 'READ') return;
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notif.id ? { ...n, status: 'READ', readAt: new Date().toISOString() } : n,
      ),
    );
    try {
      await homeApi.markNotificationRead(notif.id);
    } catch {
      // Rollback
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, status: 'UNREAD', readAt: null } : n)),
      );
    }
  }, []);

  const unreadCount = notifications.filter((n) => n.status === 'UNREAD').length;

  return (
    <SafeAreaView className="flex-1 bg-[#FFF9EA]" edges={['top', 'left', 'right']}>
      {/* Header */}
      <View className="h-[56px] flex-row items-center px-5 gap-3 border-b border-[#F0E8D0]">
        <Pressable
          onPress={onBack}
          className="w-9 h-9 items-center justify-center rounded-full bg-white"
          style={{ elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6 }}
          hitSlop={8}
        >
          <ArrowLeft size={22} color="#111" />
        </Pressable>
        <Text className="flex-1 text-[#111] text-[20px] font-bold" style={{ letterSpacing: -0.4 }}>
          Thông báo
        </Text>
        {unreadCount > 0 && (
          <View className="h-6 px-2.5 rounded-full bg-[#FF5A42] items-center justify-center">
            <Text className="text-white text-xs font-bold">
              {unreadCount > 99 ? '99+' : unreadCount} chưa đọc
            </Text>
          </View>
        )}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FFC51A" />
        </View>
      ) : notifications.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <View className="w-16 h-16 rounded-full bg-[#FFF2C9] items-center justify-center">
            <Bell size={32} color="#FFC51A" />
          </View>
          <Text className="text-[#111] text-lg font-bold text-center">Chưa có thông báo</Text>
          <Text className="text-[#999] text-sm text-center" style={{ lineHeight: 20 }}>
            Các thông báo về gợi ý món, nhắc nhở bữa ăn sẽ hiện ở đây.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FFC51A"
              colors={['#FFC51A']}
            />
          }
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View className="py-4 items-center">
                <ActivityIndicator color="#FFC51A" />
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <NotifCard notif={item} onPress={handleMarkRead} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ─── NotifCard ────────────────────────────────────────────────────────────────

function NotifCard({
  notif,
  onPress,
}: {
  notif: NotificationItem;
  onPress: (notif: NotificationItem) => void;
}) {
  const meta = TYPE_META[notif.type] ?? TYPE_META.SYSTEM;
  const Icon = meta.icon;
  const isUnread = notif.status === 'UNREAD';

  const timeAgo = formatTimeAgo(notif.createdAt);

  return (
    <Pressable
      onPress={() => onPress(notif)}
      className={`mx-4 mb-2 rounded-[18px] p-4 flex-row gap-3 ${isUnread ? 'bg-white' : 'bg-[#FAFAF7]'}`}
      style={
        isUnread
          ? {
            shadowColor: '#B19B66',
            shadowOpacity: 0.1,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 2,
          }
          : {}
      }
    >
      {/* Icon badge */}
      <View
        className="w-11 h-11 rounded-2xl items-center justify-center flex-shrink-0"
        style={{ backgroundColor: meta.bg }}
      >
        <Icon size={22} color={meta.color} strokeWidth={2} />
      </View>

      {/* Content */}
      <View className="flex-1 gap-[3px]">
        <View className="flex-row items-start justify-between gap-2">
          <Text
            className={`flex-1 text-[15px] ${isUnread ? 'font-bold text-[#111]' : 'font-semibold text-[#444]'}`}
            numberOfLines={2}
          >
            {notif.title}
          </Text>
          {isUnread && (
            <View className="w-2 h-2 rounded-full bg-[#FF5A42] mt-1 flex-shrink-0" />
          )}
        </View>
        <Text className="text-[#666] text-[13px]" style={{ lineHeight: 18 }} numberOfLines={2}>
          {notif.body}
        </Text>
        <Text className="text-[#AAA] text-xs mt-1">{timeAgo}</Text>
      </View>
    </Pressable>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;

  return new Date(dateString).toLocaleDateString('vi-VN');
}
