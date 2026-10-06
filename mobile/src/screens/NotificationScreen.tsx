import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  ChevronRight,
  Gift,
  Heart,
  MessageCircle,
  Trophy,
  UserPlus,
  Zap,
} from '@/components/icons';
import { homeApi } from '../services/api/home';
import type { NotificationItem } from '../services/api/types';
import { ListSkeleton } from '../components/skeletons/ScreenSkeletons';
import { StyledPressable as Pressable } from '../components/ui/styled-pressable';
import { AppImage } from '../components/ui/app-image';
import { notificationRealtime } from '../services/notification-realtime';

const EMPTY_MASCOT = require('../assets/images/noan/noan-thinking-v1.png');

const INK = '#2A1A10';
const MUTED = '#7E6E65';
const BG = '#FFF8EC';
const ACCENT = '#FFC928';

type Props = {
  onBack: () => void;
  onOpenDeepLink?: (deepLink: string) => void;
};

const TYPE_META: Record<
  NotificationItem['type'],
  { icon: React.ElementType; color: string; bg: string; label: string }
> = {
  SYSTEM: { icon: Zap, color: '#5B6EF5', bg: '#EEF0FE', label: 'Hệ thống' },
  PROMO: { icon: Gift, color: '#E85E2F', bg: '#FDEEE9', label: 'Ưu đãi' },
  REMINDER: { icon: Bell, color: '#E0A100', bg: '#FFF4CC', label: 'Nhắc nhở' },
  ACHIEVEMENT: { icon: Trophy, color: '#16A34A', bg: '#E3F8EA', label: 'Thành tích' },
  SOCIAL_LIKE: { icon: Heart, color: '#EF4444', bg: '#FEE2E2', label: 'Lượt thích' },
  SOCIAL_COMMENT: { icon: MessageCircle, color: '#3B82F6', bg: '#DBEAFE', label: 'Bình luận' },
  SOCIAL_FOLLOW: { icon: UserPlus, color: '#8B5CF6', bg: '#EDE9FE', label: 'Theo dõi' },
  SOCIAL_REPLY: { icon: MessageCircle, color: '#0EA5E9', bg: '#E0F2FE', label: 'Trả lời' },
};

type Filter = 'all' | 'unread';

export function NotificationScreen({ onBack, onOpenDeepLink }: Props) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const fetchNotifications = useCallback(async (p = 1, replace = true) => {
    try {
      const result = await homeApi.getNotifications({ page: p, limit: 20 });
      const items = result.data ?? [];
      setNotifications((prev) => (replace ? items : [...prev, ...items]));
      setHasMore(result.hasMore);
      setPage(p);
    } catch {
      // keep previous data
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(1, true);
  }, [fetchNotifications]);

  useEffect(() => {
    const unsub = notificationRealtime.subscribeToNewNotifications((newNotif) => {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === newNotif.id)) return prev;
        return [newNotif, ...prev];
      });
    });
    return unsub;
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications(1, true);
    notificationRealtime.refreshUnreadCount().catch(() => null);
  }, [fetchNotifications]);

  const onLoadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    fetchNotifications(page + 1, false);
  }, [hasMore, loadingMore, page, fetchNotifications]);

  const handleMarkRead = useCallback(async (notif: NotificationItem) => {
    if (notif.status === 'READ') return;
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notif.id ? { ...n, status: 'READ', readAt: new Date().toISOString() } : n,
      ),
    );
    notificationRealtime.setUnreadCount(Math.max(0, notificationRealtime.getUnreadCount() - 1));
    try {
      await homeApi.markNotificationRead(notif.id);
    } catch {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, status: 'UNREAD', readAt: null } : n)),
      );
      notificationRealtime.refreshUnreadCount().catch(() => null);
    }
  }, []);

  const handleMarkAll = useCallback(async () => {
    const snapshot = notifications;
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => ({ ...n, status: 'READ', readAt: n.readAt ?? now })));
    notificationRealtime.setUnreadCount(0);
    try {
      await homeApi.markAllNotificationsRead();
    } catch {
      setNotifications(snapshot);
      notificationRealtime.refreshUnreadCount().catch(() => null);
    }
  }, [notifications]);

  const unreadCount = notifications.filter((n) => n.status === 'UNREAD').length;

  const sections = useMemo(() => {
    const list = filter === 'unread' ? notifications.filter((n) => n.status === 'UNREAD') : notifications;
    const groups: Record<string, NotificationItem[]> = {};
    const order: string[] = [];
    list.forEach((n) => {
      const key = dayBucket(n.createdAt);
      if (!groups[key]) {
        groups[key] = [];
        order.push(key);
      }
      groups[key].push(n);
    });
    return order.map((title) => ({ title, data: groups[title] }));
  }, [notifications, filter]);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backBtn} hitSlop={8} accessibilityLabel="Quay lại">
          <ArrowLeft size={22} color={INK} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Thông báo</Text>
          <Text style={s.headerSub}>
            {unreadCount > 0 ? `Bạn có ${unreadCount > 99 ? '99+' : unreadCount} thông báo mới` : 'Bạn đã xem hết rồi'}
          </Text>
        </View>
        {unreadCount > 0 ? (
          <Pressable
            onPress={handleMarkAll}
            style={({ pressed }) => [s.markAllBtn, pressed && { opacity: 0.7 }]}
            accessibilityLabel="Đánh dấu tất cả đã đọc"
          >
            <CheckCheck size={16} color={INK} />
            <Text style={s.markAllTxt}>Đọc hết</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Filter tabs */}
      <View style={s.tabs}>
        {(['all', 'unread'] as const).map((key) => {
          const active = filter === key;
          return (
            <Pressable
              key={key}
              onPress={() => setFilter(key)}
              style={[s.tab, active && s.tabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[s.tabTxt, active && s.tabTxtActive]}>
                {key === 'all' ? 'Tất cả' : 'Chưa đọc'}
              </Text>
              {key === 'unread' && unreadCount > 0 ? (
                <View style={[s.tabBadge, active && s.tabBadgeActive]}>
                  <Text style={s.tabBadgeTxt}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <ListSkeleton rows={8} />
      ) : sections.length === 0 ? (
        <EmptyState unreadOnly={filter === 'unread' && notifications.length > 0} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} colors={[ACCENT]} />
          }
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.3}
          renderSectionHeader={({ section }) => <Text style={s.sectionTitle}>{section.title}</Text>}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                <ActivityIndicator color={ACCENT} />
              </View>
            ) : null
          }
          renderItem={({ item, index }) => (
            <NotifCard
              notif={item}
              index={index}
              onPress={async (n) => {
                await handleMarkRead(n);
                if (n.deepLink) onOpenDeepLink?.(n.deepLink);
              }}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Empty state with a gently bobbing mascot ────────────────────────────────

function EmptyState({ unreadOnly }: { unreadOnly: boolean }) {
  const bob = useSharedValue(0);
  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [bob]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }] }));

  return (
    <View style={s.empty}>
      <View style={s.emptyGlow} />
      <Animated.View style={style}>
        <Image source={EMPTY_MASCOT} style={{ width: 150, height: 150 }} resizeMode="contain" />
      </Animated.View>
      <Text style={s.emptyTitle}>{unreadOnly ? 'Đã đọc hết rồi!' : 'Chưa có thông báo'}</Text>
      <Text style={s.emptyBody}>
        {unreadOnly
          ? 'Bạn đã xem tất cả thông báo. NOAN sẽ báo ngay khi có tin mới.'
          : 'Gợi ý món, nhắc bữa ăn và tương tác cộng đồng sẽ xuất hiện ở đây.'}
      </Text>
    </View>
  );
}

// ─── NotifCard ────────────────────────────────────────────────────────────────

function NotifCard({
  notif,
  index,
  onPress,
}: {
  notif: NotificationItem;
  index: number;
  onPress: (notif: NotificationItem) => void;
}) {
  const meta = TYPE_META[notif.type] ?? TYPE_META.SYSTEM;
  const Icon = meta.icon;
  const isUnread = notif.status === 'UNREAD';

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 45).duration(320)}>
      <Pressable
        onPress={() => onPress(notif)}
        style={({ pressed }) => [
          s.card,
          isUnread ? s.cardUnread : s.cardRead,
          pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 },
        ]}
      >
        {isUnread ? <View style={s.unreadBar} /> : null}

        <View style={[s.iconBadge, { backgroundColor: meta.bg }]}>
          <Icon size={22} color={meta.color} strokeWidth={2.1} />
        </View>

        <View style={{ flex: 1 }}>
          <View style={s.metaRow}>
            <Text style={[s.typeLabel, { color: meta.color }]}>{meta.label}</Text>
            <Text style={s.dot}>·</Text>
            <Text style={s.time}>{formatTimeAgo(notif.createdAt)}</Text>
            {isUnread ? <View style={s.unreadDot} /> : null}
          </View>
          <Text style={[s.title, !isUnread && s.titleRead]} numberOfLines={2}>
            {notif.title}
          </Text>
          {notif.body ? (
            <Text style={s.body} numberOfLines={2}>
              {notif.body}
            </Text>
          ) : null}
        </View>

        {notif.imageUrl ? (
          <AppImage uri={notif.imageUrl} style={s.thumb} contentFit="cover" />
        ) : notif.deepLink ? (
          <ChevronRight size={18} color="#C4B8A8" />
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dayBucket(dateString: string): string {
  const d = new Date(dateString);
  const today = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((start(today) - start(d)) / 86400000);
  if (diffDays <= 0) return 'Hôm nay';
  if (diffDays === 1) return 'Hôm qua';
  if (diffDays < 7) return 'Tuần này';
  return 'Trước đó';
}

function formatTimeAgo(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return new Date(dateString).toLocaleDateString('vi-VN');
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8A6A2A',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: INK, letterSpacing: -0.4 },
  headerSub: { fontSize: 12.5, color: MUTED, marginTop: 1 },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF0B8',
  },
  markAllTxt: { fontSize: 13, fontWeight: '700', color: INK },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0E6D2',
  },
  tabActive: { backgroundColor: INK, borderColor: INK },
  tabTxt: { fontSize: 13.5, fontWeight: '700', color: MUTED },
  tabTxtActive: { color: '#FFFFFF' },
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: '#FF6B4A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeActive: { backgroundColor: ACCENT },
  tabBadgeTxt: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  cardUnread: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#B19B66',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardRead: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: '#F3EADB',
  },
  unreadBar: {
    position: 'absolute',
    left: 0,
    top: 14,
    bottom: 14,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: ACCENT,
  },
  iconBadge: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  typeLabel: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.2 },
  dot: { fontSize: 11.5, color: '#C4B8A8' },
  time: { fontSize: 11.5, color: MUTED, flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF6B4A' },
  title: { fontSize: 15, fontWeight: '800', color: INK, lineHeight: 20 },
  titleRead: { fontWeight: '600', color: '#5A4A3F' },
  body: { fontSize: 13, color: MUTED, lineHeight: 18, marginTop: 2 },
  thumb: { width: 48, height: 48, borderRadius: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, paddingBottom: 60 },
  emptyGlow: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(255,201,40,0.16)',
    top: '22%',
  },
  emptyTitle: { fontSize: 19, fontWeight: '800', color: INK, marginTop: 12 },
  emptyBody: { fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 20, marginTop: 6 },
});
