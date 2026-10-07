import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, FadeInDown, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { StyledPressable as Pressable } from '../../../components/ui/styled-pressable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LiquidGlassBottomNav } from '../../../components/organisms/LiquidGlassBottomNav';
import { AvatarImage } from '../../../components/organisms/AvatarImage';
import { useProfileDashboard } from '../../../hooks/useProfileDashboard';
import { authApi } from '../../../services/api/auth';
import { clearSession } from '../../../services/api/storage';
import { P, PCard, PRow } from '../ProfileUI';
import { ProfileMainSkeleton } from '../../../components/skeletons/ScreenSkeletons';
import { Bell, Bookmark, Check, ChevronRight, HeartPulse, Leaf, LockKeyhole, NotebookTabs, Pencil, Settings, Sparkles, Target } from '@/components/icons';
import { confirmAction, type Page, type Props } from '../shared';

export function ProfileMain({ open, onNotification, onLoggedOut, onDishDetail: _d, onOpenPost: _p, onOpenProfile: _o, ...nav }: Props & { open: (page: Page) => void }) {
  const { dash, isInitialLoading, isRefetching, error, refetch } = useProfileDashboard();

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const weekdayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const displayName =
    dash?.profile.displayName?.trim() || dash?.profile.username || '—';
  const username = dash?.profile.username ? `@${dash.profile.username}` : '—';
  const goalName = dash?.profile.primaryGoal?.name ?? 'Chưa đặt mục tiêu';
  const avatarUri = dash?.profile.avatar.url;
  const monthLabel = new Date().toLocaleDateString('vi-VN', { month: 'long' });

  const errorMessage = error instanceof Error ? error.message : error ? String(error) : null;

  const streak = dash?.journeyPreview.currentStreakDays ?? 0;

  return (
    <SafeAreaView style={pm.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 168 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor="#FFC928"
            colors={['#FFC928']}
          />
        }
      >
        {/* ── Gradient hero ─────────────────────────────────────────── */}
        <LinearGradient
          colors={['#FFD84D', '#FFE88F', '#FFF8EC']}
          locations={[0, 0.55, 1]}
          style={pm.hero}
        >
          <FloatingBlob size={160} top={-40} right={-50} color="rgba(255,255,255,0.35)" delay={0} />
          <FloatingBlob size={90} top={70} left={-30} color="rgba(255,170,0,0.18)" delay={500} />

          <View style={pm.topBar}>
            <Text style={pm.screenTitle}>Cá nhân</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <GlassIconButton icon={Settings} onPress={() => open('settings')} label="Cài đặt" />
              <GlassIconButton
                icon={Bell}
                onPress={onNotification}
                label="Thông báo"
                badge={dash?.notificationUnreadCount ?? 0}
              />
        </View>
            </View>

          {isInitialLoading && !dash ? <ProfileMainSkeleton /> : null}

          {dash ? (
            <Animated.View entering={FadeInDown.duration(420)} style={pm.identity}>
              <PulsingAvatar>
                <AvatarImage
                  uri={avatarUri}
                  size={92}
                  gender={dash?.profile?.gender}
                  seed={dash?.profile?.username ?? dash?.profile?.displayName}
                  isCurrentUser
                />
              </PulsingAvatar>
              <Text style={pm.name} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={pm.username}>{username}</Text>
              <View style={pm.badgeRow}>
                <View style={pm.goalPill}>
                  <Target size={14} color="#B26A00" />
                  <Text style={pm.goalTxt} numberOfLines={1}>
                    {goalName}
                  </Text>
            </View>
                {streak > 0 ? (
                  <View style={[pm.goalPill, { backgroundColor: '#FFE1D6' }]}>
                    <Text style={{ fontSize: 13 }}>🔥</Text>
                    <Text style={[pm.goalTxt, { color: '#C2410C' }]}>{streak} ngày</Text>
          </View>
                ) : null}
              </View>
              <Pressable
                onPress={() => open('edit')}
                style={({ pressed }) => [pm.editBtn, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
              >
                <Pencil size={15} color="#2A1A10" />
                <Text style={pm.editTxt}>Chỉnh sửa hồ sơ</Text>
            </Pressable>
            </Animated.View>
          ) : null}
        </LinearGradient>

        <View style={pm.body}>
          {!dash && Boolean(errorMessage) && (
            <PCard>
              <Text style={{ color: P.danger, textAlign: 'center' }}>{errorMessage}</Text>
              <Pressable style={[pm.editBtn, { alignSelf: 'center', marginTop: 12 }]} onPress={() => void refetch()}>
                <Text style={pm.editTxt}>Thử lại</Text>
              </Pressable>
            </PCard>
          )}

          {dash ? (
            <>
              {/* ── Social stats (overlaps hero) ───────────────────────── */}
              <Animated.View entering={FadeInDown.delay(80).duration(420)} style={pm.statsCard}>
                {[
                  [dash.socialStats.publishedPostCount, 'Bài viết', open.bind(null, 'posts')],
                  [dash.socialStats.savedDishCount, 'Món đã lưu', open.bind(null, 'saved')],
                  [dash.socialStats.followerCount, 'Người theo dõi', open.bind(null, 'followers')],
                  [dash.socialStats.followingCount ?? 0, 'Đang theo dõi', open.bind(null, 'following')],
                ].map(([v, l, onPress], i) => (
                  <Pressable
                    key={String(l)}
                    onPress={onPress as (() => void) | undefined}
                    disabled={!onPress}
                    style={[pm.statCell, i > 0 && pm.statDivider]}
                  >
                    <CountUp value={Number(v)} style={pm.statValue} />
                    <Text style={pm.statLabel}>{String(l)}</Text>
                  </Pressable>
                ))}
              </Animated.View>

              {/* ── Journey ─────────────────────────────────────────────── */}
              <Animated.View entering={FadeInDown.delay(160).duration(420)}>
                <PCard>
                  <View style={pm.sectionHead}>
                    <Text style={pm.cardTitle}>Hành trình tuần này</Text>
                    <Pressable onPress={() => open('journey')} style={pm.linkBtn} hitSlop={8}>
                      <Text style={pm.linkTxt}>Chi tiết</Text>
                      <ChevronRight size={16} color="#B26A00" />
                    </Pressable>
          </View>

                  <View style={pm.journeyStats}>
                    <JourneyStat emoji="🔥" value={dash.journeyPreview.currentStreakDays} label="ngày liên tiếp" tint="#FFE7DC" />
                    <JourneyStat emoji="🍱" value={dash.journeyPreview.mealsLoggedThisMonth} label="bữa đã ghi" tint="#FFF3C7" />
                    <JourneyStat emoji="✨" value={dash.journeyPreview.newDishesThisMonth} label="món mới" tint="#E6F6EA" />
                </View>

                  <View style={pm.weekRow}>
                    {dash.journeyPreview.recentDays.map((day, i) => {
                      const done = day.status === 'COMPLETED' || day.status === 'IN_PROGRESS';
                      const label = weekdayOf(day.localDate) ?? weekdayLabels[i] ?? '';
                      const isToday = i === dash.journeyPreview.recentDays.length - 1;
                      return (
                        <WeekDot key={day.localDate} done={done} today={isToday} label={label} index={i} />
                      );
                    })}
              </View>
                </PCard>
              </Animated.View>

              {/* ── Shortcuts ───────────────────────────────────────────── */}
              <Text style={pm.sectionTitle}>Của bạn</Text>
              <View style={pm.shortcutGrid}>
                {[
                  { icon: Bookmark, title: 'Món đã lưu', sub: `${dash.shortcuts.savedDishes} món`, page: 'saved', color: '#E85E2F', bg: '#FDEEE9' },
                  { icon: Sparkles, title: 'Lịch sử Random', sub: `${dash.shortcuts.randomRuns} lần`, page: 'history', color: '#8B5CF6', bg: '#EFEAFE' },
                  { icon: NotebookTabs, title: 'Nhật ký bữa ăn', sub: `${dash.shortcuts.mealLogsThisMonth} bữa · ${monthLabel}`, page: 'diary', color: '#16A34A', bg: '#E3F8EA' },
                  { icon: Pencil, title: 'Bài viết của tôi', sub: dash.shortcuts.myDraftPosts > 0 ? `${dash.shortcuts.myPublishedPosts} bài · ${dash.shortcuts.myDraftPosts} nháp` : `${dash.shortcuts.myPublishedPosts} bài`, page: 'posts', color: '#3B82F6', bg: '#E3EEFF' },
                ].map((sc, i) => (
                  <Animated.View key={sc.page} entering={FadeInDown.delay(220 + i * 60).duration(400)} style={{ width: '48.5%' }}>
                    <ColorShortcut {...sc} onPress={() => open(sc.page as Page)} />
                  </Animated.View>
            ))}
          </View>
            </>
          ) : null}

          <Text style={pm.sectionTitle}>Tài khoản</Text>
          <PCard noPadding>
            <PRow icon={HeartPulse} tint="red" title="Thông tin sức khỏe" sub="Chiều cao, cân nặng, BMI" onPress={() => open('health')} />
            <PRow icon={Target} tint="yellow" title="Mục tiêu & sở thích" sub="Khẩu vị, ẩm thực yêu thích" onPress={() => open('preferences')} />
            <PRow icon={Leaf} tint="green" title="Nguyên liệu cần tránh" sub="Dị ứng và thứ không ăn" onPress={() => open('avoid')} />
            <PRow icon={LockKeyhole} tint="blue" title="Cài đặt & quyền riêng tư" sub="Bảo mật, thông báo, dữ liệu" onPress={() => open('privacy')} last />
          </PCard>

          <Pressable
            style={({ pressed }) => [pm.logout, pressed && { opacity: 0.7 }]}
            onPress={() =>
              confirmAction('Đăng xuất?', 'Bạn sẽ cần đăng nhập lại để tiếp tục dùng app.', () => {
                void (async () => {
                  try {
                    await authApi.logout('current');
                  } catch {
                    await clearSession();
                  }
                  onLoggedOut?.();
                })();
              }, 'Đăng xuất', 'warning')
            }
          >
            <Text style={pm.logoutTxt}>Đăng xuất</Text>
        </Pressable>
        </View>
      </ScrollView>
      <LiquidGlassBottomNav active="profile" {...nav} />
    </SafeAreaView>
  );
}

// ─── Profile main: animated building blocks ──────────────────────────────────

const WEEKDAY_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
function weekdayOf(localDate: string): string | null {
  const [y, m, d] = localDate.split('-').map(Number);
  if (!y || !m || !d) return null;
  return WEEKDAY_VI[new Date(y, m - 1, d).getDay()] ?? null;
}

function FloatingBlob({
  size,
  color,
  delay,
  top,
  left,
  right,
}: {
  size: number;
  color: string;
  delay: number;
  top?: number;
  left?: number;
  right?: number;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
    return () => cancelAnimation(t);
  }, [t, delay]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: t.value * 14 }, { scale: 1 + t.value * 0.08 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color, top, left, right },
        style,
      ]}
    />
  );
}

function PulsingAvatar({ children }: { children: ReactNode }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }), -1, false);
    return () => cancelAnimation(p);
  }, [p]);
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.6 * (1 - p.value),
    transform: [{ scale: 1 + p.value * 0.28 }],
  }));
  return (
    <View style={pm.avatarWrap}>
      <Animated.View pointerEvents="none" style={[pm.avatarRing, ringStyle]} />
      <View style={pm.avatarBorder}>{children}</View>
    </View>
  );
}

function CountUp({ value, style }: { value: number; style: any }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!value) {
      setShown(0);
      return;
    }
    const start = Date.now();
    const dur = 650;
    const id = setInterval(() => {
      const k = Math.min(1, (Date.now() - start) / dur);
      setShown(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k >= 1) clearInterval(id);
    }, 32);
    return () => clearInterval(id);
  }, [value]);
  return <Text style={style}>{shown}</Text>;
}

function GlassIconButton({
  icon: Icon,
  onPress,
  label,
  badge = 0,
}: {
  icon: ComponentType<any>;
  onPress?: () => void;
  label: string;
  badge?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      style={({ pressed }) => [pm.glassBtn, pressed && { transform: [{ scale: 0.92 }] }]}
    >
      <Icon size={21} color="#2A1A10" />
      {badge > 0 ? (
        <View style={pm.badge}>
          <Text style={pm.badgeTxt}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function JourneyStat({ emoji, value, label, tint }: { emoji: string; value: number; label: string; tint: string }) {
  return (
    <View style={[pm.jStat, { backgroundColor: tint }]}>
      <Text style={{ fontSize: 18 }}>{emoji}</Text>
      <CountUp value={value} style={pm.jValue} />
      <Text style={pm.jLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function WeekDot({ done, today, label, index }: { done: boolean; today: boolean; label: string; index: number }) {
  const s = useSharedValue(0);
  useEffect(() => {
    s.value = withDelay(250 + index * 70, withSpring(1, { damping: 9, stiffness: 160 }));
  }, [s, index]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <Animated.View style={[pm.dot, done ? pm.dotDone : pm.dotIdle, today && !done && pm.dotToday, style]}>
        {done ? <Check size={16} color="#fff" strokeWidth={3} /> : null}
      </Animated.View>
      <Text style={[pm.dotLabel, today && { color: '#2A1A10', fontWeight: '800' }]}>{label}</Text>
    </View>
  );
}

function ColorShortcut({
  icon: Icon,
  title,
  sub,
  color,
  bg,
  onPress,
}: {
  icon: ComponentType<any>;
  title: string;
  sub: string;
  color: string;
  bg: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pm.shortcut, pressed && { transform: [{ scale: 0.97 }], opacity: 0.92 }]}
    >
      <View style={[pm.shortcutIcon, { backgroundColor: bg }]}>
        <Icon size={20} color={color} />
      </View>
      <Text style={pm.shortcutTitle} numberOfLines={1}>
        {title}
      </Text>
      <Text style={pm.shortcutSub} numberOfLines={1}>
        {sub}
      </Text>
    </Pressable>
  );
}

const pm = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF8EC' },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 54,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  topBar: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  screenTitle: { fontSize: 28, fontWeight: '800', color: '#2A1A10', letterSpacing: -0.6 },
  glassBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 3,
    backgroundColor: '#FF5A3C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeTxt: { fontSize: 9.5, fontWeight: '800', color: '#FFFFFF' },
  identity: { alignItems: 'center', marginTop: 4 },
  avatarWrap: { width: 112, height: 112, alignItems: 'center', justifyContent: 'center' },
  avatarRing: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarBorder: {
    borderRadius: 52,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#9A6A00',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    backgroundColor: '#FFFFFF',
  },
  name: { fontSize: 24, fontWeight: '800', color: '#2A1A10', marginTop: 8, letterSpacing: -0.4 },
  username: { fontSize: 14, color: '#6B5A4A', marginTop: 1 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' },
  goalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.75)',
    maxWidth: 220,
  },
  goalTxt: { fontSize: 12.5, fontWeight: '700', color: '#7A4A00', flexShrink: 1 },
  editBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    shadowColor: '#9A6A00',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  editTxt: { fontSize: 14, fontWeight: '700', color: '#2A1A10' },
  body: { paddingHorizontal: 18, gap: 14 },
  statsCard: {
    marginTop: -34,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 14,
    shadowColor: '#5D490F',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  statCell: { flex: 1, alignItems: 'center' },
  statDivider: { borderLeftWidth: 1, borderLeftColor: '#F0E8DA' },
  statValue: { fontSize: 21, fontWeight: '800', color: '#2A1A10' },
  statLabel: { fontSize: 12.5, color: '#7E6E65', marginTop: 2 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#2A1A10' },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  linkTxt: { fontSize: 14, fontWeight: '700', color: '#B26A00' },
  journeyStats: { flexDirection: 'row', gap: 8, marginTop: 12 },
  jStat: { flex: 1, borderRadius: 16, paddingVertical: 10, alignItems: 'center' },
  jValue: { fontSize: 20, fontWeight: '800', color: '#2A1A10', marginTop: 2 },
  jLabel: { fontSize: 11.5, color: '#6B5A4A', marginTop: 1 },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingHorizontal: 2,
  },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dotDone: {
    backgroundColor: '#FFB800',
    shadowColor: '#FFB800',
    shadowOpacity: 0.45,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  dotIdle: { backgroundColor: '#FFF6DE', borderWidth: 1.5, borderColor: '#F3DFA8' },
  dotToday: { borderColor: '#FFB800', borderWidth: 2, borderStyle: 'dashed' },
  dotLabel: { fontSize: 11.5, color: '#8C7B6E', fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#2A1A10', marginTop: 6, marginBottom: -2 },
  shortcutGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  shortcut: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    minHeight: 104,
    shadowColor: '#5D490F',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  shortcutIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  shortcutTitle: { fontSize: 14.5, fontWeight: '800', color: '#2A1A10' },
  shortcutSub: { fontSize: 12.5, color: '#7E6E65', marginTop: 2 },
  logout: {
    marginTop: 4,
    height: 50,
    borderRadius: 18,
    backgroundColor: '#FFEDEA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutTxt: { fontSize: 15.5, fontWeight: '800', color: '#E5402A' },
});

