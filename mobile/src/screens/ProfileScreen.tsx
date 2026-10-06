import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  FadeInDown,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { StyledPressable as Pressable } from '../components/ui/styled-pressable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LiquidGlassBottomNav } from '../components/organisms/LiquidGlassBottomNav';
import { ImageUploadField, type UploadImage } from '../components/organisms/ImageUploadField';
import { AvatarImage } from '../components/organisms/AvatarImage';
import { profileApi, type ProfileDashboard } from '../services/api/profile';
import { useProfileDashboard, PROFILE_DASHBOARD_QUERY_KEY } from '../hooks/useProfileDashboard';
import { queryClient } from '../lib/query-client';
import { authApi } from '../services/api/auth';
import { clearSession, getSavedDefaultAvatarKey } from '../services/api/storage';
import { getMemoryDefaultAvatarKey, setMemoryDefaultAvatarKey } from '../theme/default-avatars';
import { dishesApi } from '../services/api/dishes';
import { healthApi } from '../services/api/health';
import { communityApi, type ExplorePost } from '../services/api/explore';
import { onboardingApi } from '../services/api/onboarding';
import { ingredientsApi, type IngredientItem } from '../services/api/ingredients';
import { normalizeImageUrl } from '../services/api/randomization';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { ScreenSlideTransition } from '../components/ui/screen-transition';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  P,
  PageScaffold,
  PButton,
  PCard,
  PChip,
  PField,
  PInput,
  PRow,
  PSearchBar,
  PTabs,
  PToggleRow,
  ProgressBar,
  SectionTitle,
  StatTile,
  SubHeader,
  InfoBanner,
  InlineNotice,
  EmptyBlock,
} from './profile/ProfileUI';
import { uploadSignedImage, type SignedImageUpload } from '../services/uploads/signed-image';
import { getDeviceTimeZone, getTodayISO } from '../lib/dates';
import type { CatalogItem, SavedDishItem } from '../services/api/types';
import { MealJournalScreen } from './meal-journal/MealJournalScreen';
import {
  registerPushNotificationsAsync,
  unregisterPushNotificationsAsync,
} from '../lib/push-notifications';
import {
  syncCurrentMealReminders,
  cancelMealReminders,
} from '../lib/meal-reminders';

function toLocalDateISO(d: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}
import {
  recordHealthMeasurementStore,
  recordPreferencesUpdatedStore,
  recordAvoidancesUpdatedStore,
  recordProfileUpdatedStore,
} from '../services/app-store';
import {
  FormRowsSkeleton,
  JourneySkeleton,
  ListSkeleton,
  ProfileEditSkeleton,
  ProfileMainSkeleton,
  RandomHistorySkeleton,
  FoodListSkeleton,
} from '../components/skeletons/ScreenSkeletons';
import {
  Bell,
  Bookmark,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Compass,
  FileText,
  Globe2,
  Heart,
  HeartPulse,
  History,
  Home,
  Info,
  Leaf,
  LockKeyhole,
  MapPin,
  MessageCircle,
  NotebookTabs,
  Pencil,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Trash2,
  Trophy,
  UserRound,
  Users,
  Utensils,
  Wallet,
  X,
  Zap,
} from '@/components/icons';

const dishPlaceholder = require('../assets/images/random/pho-result.jpg');

function errMsg(e: unknown, fallback = 'Đã xảy ra lỗi.') {
  return (e as { message?: string })?.message ?? fallback;
}

const GENDER_OPTIONS = ['Nam', 'Nữ'] as const;

type ConfirmState = {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone: 'warning' | 'danger';
  onConfirm: () => void;
} | null;

let setGlobalConfirmState: ((s: ConfirmState) => void) | null = null;

function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmText = 'Xác nhận',
  tone: 'warning' | 'danger' = 'danger',
) {
  if (setGlobalConfirmState) {
    setGlobalConfirmState({
      visible: true,
      title,
      description: message,
      confirmLabel: confirmText,
      tone,
      onConfirm,
    });
  } else {
    Alert.alert(title, message, [
      { text: 'Hủy', style: 'cancel' },
      { text: confirmText, style: 'destructive', onPress: onConfirm },
    ]);
  }
}

function formatGender(g?: string | null) {
  if (g === 'MALE') return 'Nam';
  if (g === 'FEMALE') return 'Nữ';
  return '';
}

function parseGenderLabel(label: string): string | null {
  if (label === 'Nam') return 'MALE';
  if (label === 'Nữ') return 'FEMALE';
  return null;
}

function formatDob(iso?: string | null) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function parseDobInput(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (dmy) {
    const dd = dmy[1].padStart(2, '0');
    const mm = dmy[2].padStart(2, '0');
    return `${dmy[3]}-${mm}-${dd}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return null;
}

function dishImageSource(url?: string | null, media?: Array<{ storageKey?: string; bucket?: string; publicUrl?: string }>): ImageSourcePropType {
  const normalized = normalizeImageUrl(url);
  if (normalized) return { uri: normalized };
  const primary = media?.[0];
  if (primary?.publicUrl) {
    const u = normalizeImageUrl(primary.publicUrl);
    if (u) return { uri: u };
  }
  if (primary?.storageKey) {
    const base = (
      process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://lkqvyvllmrbxgaoqrkhd.supabase.co'
    ).replace(/\/$/, '');
    if (base) {
      const bucket = primary.bucket ?? 'dish-images';
      return { uri: `${base}/storage/v1/object/public/${bucket}/${primary.storageKey}` };
    }
  }
  return dishPlaceholder;
}

function formatPriceRange(min?: number | null, max?: number | null) {
  if (min == null && max == null) return null;
  const fmt = (n: number) => `${Math.round(n / 1000)}K`;
  if (min != null && max != null) return `${fmt(min)}–${fmt(max)}`;
  if (min != null) return `Từ ${fmt(min)}`;
  return `Đến ${fmt(max!)}`;
}

function mealSlotLabel(slot?: string | null) {
  const s = (slot ?? '').toUpperCase();
  if (s === 'BREAKFAST') return 'Bữa sáng';
  if (s === 'LUNCH') return 'Bữa trưa';
  if (s === 'DINNER') return 'Bữa tối';
  if (s === 'SNACK') return 'Bữa phụ';
  return slot || 'Bữa ăn';
}

function activityLabel(code?: string | null) {
  const c = (code ?? '').toUpperCase();
  if (c === 'SEDENTARY' || c === 'LOW') return 'Ít vận động';
  if (c === 'MODERATE' || c === 'MEDIUM') return 'Vừa phải';
  if (c === 'ACTIVE' || c === 'HIGH' || c === 'VERY_ACTIVE') return 'Năng động';
  return code || '—';
}

function formatRelTime(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

type Page =
  | 'main'
  | 'settings'
  | 'edit'
  | 'journey'
  | 'health'
  | 'preferences'
  | 'avoid'
  | 'saved'
  | 'privacy'
  | 'history'
  | 'posts'
  | 'diary';
type Props = {
  onHome: () => void;
  onExplore: () => void;
  onRandom: () => void;
  onHealth: () => void;
  onNotification?: () => void;
  onLoggedOut?: () => void;
  onDishDetail?: (dishId: string, title?: string) => void;
};

export function ProfileScreen(props: Props) {
  const [page, setPage] = useState<Page>('main');
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const handleOpenDish = useCallback(
    (dishId: string, title?: string) => {
      if (props.onDishDetail) {
        props.onDishDetail(dishId, title);
      }
    },
    [props.onDishDetail],
  );

  useEffect(() => {
    setGlobalConfirmState = setConfirmState;
    return () => {
      setGlobalConfirmState = null;
    };
  }, []);

  useEffect(() => {
    if (page === 'main') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setPage('main');
      return true;
    });
    return () => sub.remove();
  }, [page]);

  return (
    <>
      <View style={{ flex: 1 }}>
        <ProfileMain {...props} open={setPage} />
          </View>
      <ScreenSlideTransition
        visible={page !== 'main'}
        direction="right"
        onBack={() => setPage('main')}
      >
        {page !== 'main' ? (
          <SubScreen
            page={page}
            onBack={() => setPage('main')}
            onLoggedOut={props.onLoggedOut}
            onOpenDish={handleOpenDish}
          />
        ) : null}
      </ScreenSlideTransition>
      {confirmState ? (
        <ConfirmDialog
          visible={confirmState.visible}
          title={confirmState.title}
          description={confirmState.description}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel="Huỷ"
          tone={confirmState.tone}
          onConfirm={() => {
            const action = confirmState.onConfirm;
            setConfirmState(null);
            action();
          }}
          onCancel={() => setConfirmState(null)}
        />
      ) : null}
    </>
  );
}

function ProfileMain({ open, onNotification, onLoggedOut, ...nav }: Props & { open: (page: Page) => void }) {
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
                  [dash.socialStats.followerCount, 'Người theo dõi', undefined],
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


function SubScreen({
  page,
  onBack,
  onLoggedOut,
  onOpenDish,
}: {
  page: Exclude<Page, 'main'>;
  onBack: () => void;
  onLoggedOut?: () => void;
  onOpenDish?: (dishId: string, title?: string) => void;
}) {
  if (page === 'diary') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top', 'bottom']}>
        <MealJournalScreen onBack={onBack} onOpenDish={onOpenDish} />
      </SafeAreaView>
    );
  }

  const meta: Record<Exclude<Page, 'main' | 'diary'>, { title: string; sub: string }> = {
    settings: { title: 'Cài đặt', sub: 'Thông báo, giao diện và tài khoản' },
    edit: { title: 'Chỉnh sửa hồ sơ', sub: 'Ảnh đại diện và thông tin cơ bản' },
    journey: { title: 'Hành trình của bạn', sub: 'Chuỗi ngày, lịch và thành tích' },
    health: { title: 'Thông tin sức khỏe', sub: 'Chỉ số cơ thể và mục tiêu mỗi ngày' },
    preferences: { title: 'Mục tiêu & sở thích', sub: 'Giúp NOAN gợi ý đúng gu của bạn' },
    avoid: { title: 'Nguyên liệu cần tránh', sub: 'Dị ứng và những thứ bạn không ăn' },
    saved: { title: 'Món đã lưu', sub: 'Bộ sưu tập của bạn' },
    privacy: { title: 'Cài đặt & quyền riêng tư', sub: 'Bảo mật, hiển thị và dữ liệu' },
    history: { title: 'Lịch sử Random', sub: 'Những lần NOAN chọn món cho bạn' },
    posts: { title: 'Bài viết của tôi', sub: 'Đã đăng và bản nháp' },
  };
  const m = meta[page];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: P.bg }} edges={['top', 'left', 'right']}>
      <SubHeader title={m.title} subtitle={m.sub} onBack={onBack} />
        {page === 'settings' ? (
        <SettingsPage onLoggedOut={onLoggedOut} />
        ) : page === 'edit' ? (
          <EditPage />
        ) : page === 'journey' ? (
          <JourneyPage />
        ) : page === 'health' ? (
          <HealthPage />
        ) : page === 'preferences' ? (
          <PreferencesPage />
        ) : page === 'avoid' ? (
          <AvoidPage />
        ) : page === 'saved' ? (
        <SavedPage onOpenDish={onOpenDish} />
        ) : page === 'privacy' ? (
          <PrivacyPage />
        ) : page === 'history' ? (
        <HistoryPage onOpenDish={onOpenDish} />
        ) : (
        <PostsPage />
        )}
    </SafeAreaView>
  );
}

function LoadBlock({
  loading,
  error,
  onRetry,
  empty,
  emptyText,
  emptyEmoji = '🍃',
  skeleton = 'form',
  children,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  empty?: boolean;
  emptyText?: string;
  emptyEmoji?: string;
  skeleton?: 'edit' | 'form' | 'list' | 'journey' | 'history' | 'saved';
  children: ReactNode;
}) {
  if (loading) {
    if (skeleton === 'edit') return <ProfileEditSkeleton />;
    if (skeleton === 'history') return <RandomHistorySkeleton />;
    if (skeleton === 'saved') return <FoodListSkeleton count={5} />;
    if (skeleton === 'list') return <ListSkeleton rows={5} padded={false} />;
    if (skeleton === 'journey') return <JourneySkeleton />;
    return <FormRowsSkeleton rows={5} />;
  }
  if (error) {
  return (
      <PCard>
        <EmptyBlock
          emoji="😵"
          title="Không tải được"
          body={error}
          action={<PButton text="Thử lại" onPress={onRetry} variant="dark" />}
        />
      </PCard>
    );
  }
  if (empty) {
  return (
      <PCard>
        <EmptyBlock emoji={emptyEmoji} title={emptyText ?? 'Chưa có dữ liệu'} />
      </PCard>
    );
  }
  return <>{children}</>;
}

type MeProfile = {
  version?: number;
  profileVersion?: number;
  basic?: {
    displayName?: string | null;
    username?: string | null;
    dateOfBirth?: string | null;
    gender?: string | null;
    bio?: string | null;
    region?: { id: string; code: string; name: string } | null;
    timezone?: string | null;
  };
  avatar?: { url?: string | null; thumbnailUrl?: string | null };
  preferences?: {
    primaryGoal?: { id: string; code: string; name: string } | null;
    tastePreferences?: CatalogItem[];
    dietTypes?: CatalogItem[];
    selectionPriorities?: Array<{ code: string; weight: number }>;
    allergens?: CatalogItem[];
    avoidedIngredients?: Array<{
      id?: string;
      name?: string;
      ingredientName?: string;
      ingredientId?: string | null;
      text?: string;
    }>;
  };
  displayName?: string | null;
  avatarUrl?: string | null;
};

// ─── Settings ────────────────────────────────────────────────────────────────

function SettingsPage({ onLoggedOut }: { onLoggedOut?: () => void }) {
  const [me, setMe] = useState<MeProfile | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setActionError(null);
    try {
      const [profile, s] = await Promise.all([profileApi.me<MeProfile>(), profileApi.getSettings<any>()]);
      setMe(profile);
      setSettings(s);
    } catch (e) {
      setError(errMsg(e, 'Không tải được cài đặt.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patchSettings = async (patch: Record<string, unknown>) => {
    if (!settings) return;
    setBusy(true);
    setActionError(null);
    try {
      const next = await profileApi.updateSettings(patch, settings.version ?? 1);
      setSettings(next);
    } catch (e) {
      setActionError(errMsg(e, 'Không lưu được cài đặt.'));
    } finally {
      setBusy(false);
    }
  };

  const name = me?.basic?.displayName ?? me?.displayName ?? '—';
  const username = me?.basic?.username ? `@${me.basic.username}` : '—';
  const avatarUri = me?.avatar?.url ?? me?.avatar?.thumbnailUrl ?? me?.avatarUrl;
  const themeLabel =
    settings?.theme === 'DARK' || settings?.appTheme === 'DARK'
      ? 'Tối'
      : settings?.theme === 'SYSTEM' || settings?.appTheme === 'SYSTEM'
        ? 'Hệ thống'
        : 'Sáng';
  const lang = settings?.language === 'en' ? 'English' : 'Tiếng Việt';
  const push = !!settings?.notifications?.pushEnabled;
  const reminders = !!settings?.notifications?.mealReminders;

  return (
    <PageScaffold>
      <LoadBlock loading={loading} error={error} onRetry={load} skeleton="form">
        <PCard delay={0} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <AvatarImage
            uri={avatarUri}
            size={64}
            gender={me?.basic?.gender}
            seed={me?.basic?.username ?? me?.basic?.displayName}
            isCurrentUser
          />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 19, fontWeight: '800', color: P.ink }} numberOfLines={1}>
              {name}
            </Text>
            <Text style={{ fontSize: 14, color: P.muted, marginTop: 2 }}>{username}</Text>
          </View>
        </PCard>

        <SectionTitle title="Thông báo" />
        <PCard noPadding delay={60}>
          <PToggleRow
            icon={Bell}
            tint="orange"
            title="Thông báo đẩy"
            sub={push ? 'Bữa ăn, cộng đồng và nhắc nhở' : 'Đang tắt'}
            value={push}
            disabled={busy}
            onChange={async (v) => {
              await patchSettings({ pushNotificationsEnabled: v });
              if (v) void registerPushNotificationsAsync();
              else void unregisterPushNotificationsAsync();
            }}
          />
          <PToggleRow
            icon={Clock3}
            tint="green"
            title="Nhắc bữa ăn"
            sub="Nhắc bạn ghi lại bữa sáng, trưa, tối"
            value={reminders}
            disabled={busy}
            onChange={async (v) => {
              await patchSettings({ mealRemindersEnabled: v });
              if (v) void syncCurrentMealReminders();
              else void cancelMealReminders();
            }}
            last
          />
        </PCard>

        <SectionTitle title="Ứng dụng" />
        <PCard noPadding delay={120}>
          <PRow icon={Sun} tint="yellow" title="Giao diện" value={themeLabel} />
          <PRow icon={Globe2} tint="blue" title="Ngôn ngữ" value={lang} />
          <PRow
            icon={ShieldCheck}
            tint="purple"
            title="Đồng bộ dữ liệu"
            value={settings?.privacy?.analyticsEnabled ? 'Đã bật' : 'Đang tắt'}
            last
          />
        </PCard>

        {actionError ? <InlineNotice tone="error" text={actionError} /> : null}

        <PButton
          text="Đăng xuất"
          variant="danger"
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
        />
      </LoadBlock>
    </PageScaffold>
  );
}

// ─── Edit profile ────────────────────────────────────────────────────────────

function EditPage() {
  const { updateDashboardCache } = useProfileDashboard();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(1);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [bio, setBio] = useState('');
  const [regionName, setRegionName] = useState('');
  const [regionId, setRegionId] = useState<string | null>(null);
  const [regions, setRegions] = useState<Array<{ id: string; name: string }>>([]);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [defaultAvatarId, setDefaultAvatarId] = useState<string | null>(getMemoryDefaultAvatarKey());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSaveMsg(null);
    try {
      const [me, regionRes, savedAvatarKey] = await Promise.all([
        profileApi.me<MeProfile>(),
        profileApi.getRegions(undefined, 50).catch(() => ({ items: [] as Array<{ id: string; name: string }> })),
        getSavedDefaultAvatarKey(),
      ]);
      if (savedAvatarKey) setDefaultAvatarId(savedAvatarKey);
      setVersion(me.version ?? me.profileVersion ?? 1);
      setAvatarUri(me.avatar?.url ?? me.avatar?.thumbnailUrl ?? me.avatarUrl ?? null);
      setDisplayName(me.basic?.displayName ?? me.displayName ?? '');
      setUsername(me.basic?.username ?? '');
      setDob(formatDob(me.basic?.dateOfBirth));
      setGender(formatGender(me.basic?.gender));
      setBio(me.basic?.bio ?? '');
      setRegionName(me.basic?.region?.name ?? '');
      setRegionId(me.basic?.region?.id ?? null);
      setRegions(regionRes.items ?? []);
    } catch (e) {
      setError(errMsg(e, 'Không tải được hồ sơ.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setSaveMsg(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        displayName: displayName.trim() || null,
        bio: bio.trim() || null,
        gender: parseGenderLabel(gender),
        regionId,
      };
      const dobIso = parseDobInput(dob);
      if (dob.trim() && !dobIso) {
        setError('Ngày sinh chưa đúng định dạng (dd/mm/yyyy).');
        setSaving(false);
        return;
      }
      body.dateOfBirth = dobIso;
      const updated = await profileApi.updateBasic<MeProfile>(body, version);
      setVersion(updated.version ?? updated.profileVersion ?? version + 1);
      recordProfileUpdatedStore({ displayName: displayName.trim() || null });
      setSaveMsg('Đã lưu thay đổi.');
    } catch (e) {
      setError(errMsg(e, 'Không lưu được hồ sơ.'));
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (image: UploadImage, onProgress: (percent: number) => void) => {
    const intent = await profileApi.createAvatarIntent<{ mediaId: string; upload: SignedImageUpload }>({
      mimeType: image.mimeType,
      sizeBytes: image.sizeBytes,
      width: image.width,
      height: image.height,
    });
    await uploadSignedImage(image, intent.upload, onProgress);
    const avatar = await profileApi.finalizeAvatar<{ url: string }>(intent.mediaId);
    setAvatarUri(avatar.url);
    recordProfileUpdatedStore({ avatarUrl: avatar.url });
    try {
      const me = await profileApi.me<MeProfile>();
      setVersion(me.version ?? me.profileVersion ?? version + 1);
    } catch {
      setVersion((c) => c + 1);
    }
    return avatar.url;
  };

  const removeAvatar = async () => {
    await profileApi.deleteAvatar(version);
    setAvatarUri(null);
    recordProfileUpdatedStore({ avatarUrl: null });
    try {
      const me = await profileApi.me<MeProfile>();
      setVersion(me.version ?? me.profileVersion ?? version + 1);
    } catch {
      setVersion((c) => c + 1);
    }
  };

  const bioMax = 160;

  return (
    <PageScaffold
      gap={10}
      footer={
        <PButton text={saving ? 'Đang lưu…' : 'Lưu thay đổi'} onPress={save} disabled={saving} loading={saving} />
      }
    >
      <LoadBlock loading={loading} error={error && !displayName ? error : null} onRetry={load} skeleton="edit">
        <LinearGradient
          colors={['#FFE38A', '#FFF4D2']}
          style={{ borderRadius: 24, paddingVertical: 18, alignItems: 'center', marginBottom: 4 }}
        >
          <ImageUploadField
            value={avatarUri}
            variant="avatar"
            label="Ảnh đại diện"
            gender={parseGenderLabel(gender)}
            seed={username || displayName}
            defaultAvatarId={defaultAvatarId}
            onUpload={uploadAvatar}
            onRemove={avatarUri ? removeAvatar : undefined}
            onSelectDefaultAvatar={(key) => {
              setDefaultAvatarId(key);
              setMemoryDefaultAvatarKey(key);
              setAvatarUri(null);
              recordProfileUpdatedStore({ avatarUrl: null });
              updateDashboardCache((prev) =>
                prev ? { ...prev, profile: { ...prev.profile, avatar: { ...prev.profile.avatar, url: null } } } : prev,
              );
            }}
            confirmRemove
          />
          <Text style={{ fontSize: 12.5, color: '#7A4A00', marginTop: 6, fontWeight: '600' }}>
            Chạm vào ảnh để thay đổi
          </Text>
        </LinearGradient>

        <SectionTitle title="Thông tin cơ bản" />
        <PField label="Họ và tên" icon={UserRound}>
          <PInput value={displayName} onChangeText={setDisplayName} placeholder="Tên hiển thị của bạn" maxLength={50} />
        </PField>
        <PField label="Tên người dùng" icon={Info} locked hint="Tên người dùng không thể thay đổi">
          <PInput value={username ? `@${username}` : ''} editable={false} placeholder="—" />
        </PField>
        <PField label="Ngày sinh" icon={CalendarDays} tint="orange" hint="Định dạng dd/mm/yyyy">
          <PInput value={dob} onChangeText={setDob} placeholder="01/01/2000" keyboardType="numbers-and-punctuation" />
        </PField>
        <PField label="Giới tính" icon={UserRound} tint="purple">
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
            {GENDER_OPTIONS.map((g) => (
              <PChip key={g} text={g} active={gender === g} onPress={() => setGender(gender === g ? '' : g)} check />
            ))}
            </View>
        </PField>
        <PField label="Khu vực" icon={MapPin} tint="green">
          <Select
            value={regionId ? { value: regionId, label: regionName || 'Đã chọn' } : undefined}
            onValueChange={(opt) => {
              if (!opt || !opt.value || opt.value === '__none__') {
                setRegionId(null);
                setRegionName('');
                return;
              }
              const found = regions.find((r) => r.id === opt.value);
              setRegionId(opt.value);
              setRegionName(found?.name ?? opt.label);
            }}
          >
            <SelectTrigger className="mt-0.5 h-8 border-0 bg-transparent p-0 shadow-none">
              <SelectValue placeholder="Chọn khu vực" className="text-[15.5px] font-semibold" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="__none__" label="Không chọn">
                Không chọn
              </SelectItem>
              {regions.map((r) => (
                <SelectItem key={r.id} value={r.id} label={r.name}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PField>

        <SectionTitle title="Giới thiệu" sub={`${bio.length}/${bioMax}`} />
        <PCard style={{ paddingVertical: 12 }}>
          <PInput
            value={bio}
            onChangeText={(t) => setBio(t.slice(0, bioMax))}
            placeholder="Vài dòng về bạn và gu ăn uống…"
            multiline
            style={{ minHeight: 76, textAlignVertical: 'top', fontWeight: '500', lineHeight: 21 }}
          />
        </PCard>

        {error ? <InlineNotice tone="error" text={error} /> : null}
        {saveMsg ? <InlineNotice tone="success" text={saveMsg} /> : null}
      </LoadBlock>
    </PageScaffold>
  );
}

// ─── Journey ─────────────────────────────────────────────────────────────────

function JourneyPage() {
  const tz = getDeviceTimeZone();
  const month = getTodayISO(tz).slice(0, 7);

  const { data, isLoading, error: queryError, refetch } = useQuery<any>({
    queryKey: ['profile', 'journey', month, tz],
    queryFn: () => profileApi.getJourney<any>(month, tz),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const loading = isLoading && !data;
  const error = queryError ? errMsg(queryError, 'Không tải được hành trình.') : null;
  const load = useCallback(() => void refetch(), [refetch]);

  const streak = data?.streak?.currentDays ?? data?.currentStreakDays ?? 0;
  const longest = data?.streak?.longestDays ?? data?.longestStreakDays ?? 0;
  const achievements: Array<any> = data?.achievements ?? [];
  const monthlyGoals: Array<any> = data?.monthlyGoals ?? [];
  const days: Array<{ localDate: string; status: string }> = data?.days ?? [];
  const activeDays = days.filter(
    (d) => d.status === 'QUALIFIED' || d.status === 'COMPLETED' || d.status === 'IN_PROGRESS',
  ).length;

  return (
    <PageScaffold>
      <LoadBlock loading={loading} error={error} onRetry={load} skeleton="journey">
        <Animated.View entering={FadeInDown.duration(380)}>
          <LinearGradient
            colors={['#FF9A3C', '#FFC928']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={js.hero}
          >
            <FlameBadge />
        <View style={{ flex: 1 }}>
              <Text style={js.heroLabel}>Chuỗi ngày hiện tại</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
                <Text style={js.heroValue}>{streak}</Text>
                <Text style={js.heroUnit}>ngày</Text>
        </View>
              <Text style={js.heroSub}>
                {streak > 0 ? 'Tuyệt vời! Giữ vững phong độ nhé 💪' : 'Ghi một bữa hôm nay để bắt đầu chuỗi!'}
              </Text>
      </View>
          </LinearGradient>
        </Animated.View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <StatTile emoji="🏆" value={longest} unit="ngày" label="Kỷ lục dài nhất" tint="yellow" />
          <StatTile emoji="📅" value={activeDays} unit="ngày" label="Hoạt động tháng này" tint="green" />
        </View>

        <PCard delay={100}>
          <MonthCalendar month={data?.month ?? month} days={days} />
        </PCard>

        <SectionTitle title="Thành tích" sub={achievements.length ? `${achievements.length} huy hiệu` : undefined} />
        {achievements.length === 0 ? (
          <PCard>
            <EmptyBlock emoji="🎖️" title="Chưa có thành tích" body="Ghi bữa đều đặn để mở khoá huy hiệu đầu tiên." />
          </PCard>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {achievements.map((a, i) => {
              const progress = Number(a.progress ?? 0);
              const target = Math.max(Number(a.target ?? 1), 1);
              const done = progress >= target;
              return (
                <Animated.View
                  key={a.id ?? a.code ?? i}
                  entering={FadeInDown.delay(140 + i * 50).duration(360)}
                  style={[js.badge, done && js.badgeDone]}
                >
                  <View style={[js.badgeIcon, done && { backgroundColor: '#FFE08A' }]}>
                    <Trophy size={22} color={done ? '#B26A00' : P.faint} />
            </View>
                  <Text style={js.badgeName} numberOfLines={2}>
                    {a.name}
                  </Text>
                  <Text style={js.badgeProgress}>
                    {progress}/{target}
                  </Text>
                  <View style={{ width: '100%', marginTop: 6 }}>
                    <ProgressBar pct={(progress / target) * 100} height={5} color={done ? '#FFB800' : '#E5D9BE'} />
        </View>
                </Animated.View>
              );
            })}
          </View>
        )}

        <SectionTitle title="Tiến độ tháng này" />
        <PCard delay={200}>
          {monthlyGoals.length === 0 ? (
            <Text style={{ color: P.muted, textAlign: 'center', paddingVertical: 8 }}>Chưa có mục tiêu tháng.</Text>
          ) : (
            monthlyGoals.map((g, i) => {
              const current = Number(g.current ?? 0);
              const target = Math.max(Number(g.target ?? 1), 1);
              const pct = Math.min(100, Math.round((current / target) * 100));
  return (
                <View key={g.code ?? g.label} style={{ paddingVertical: 8, gap: 8, borderTopWidth: i ? 1 : 0, borderTopColor: '#F6EFE2' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: P.ink, flex: 1 }}>{g.label}</Text>
                    <Text style={{ fontSize: 13.5, fontWeight: '800', color: pct >= 100 ? P.success : P.accentDeep }}>
                      {current}/{target}
                    </Text>
      </View>
                  <ProgressBar pct={pct} color={pct >= 100 ? '#22C55E' : P.accent} />
      </View>
              );
            })
          )}
        </PCard>
      </LoadBlock>
    </PageScaffold>
  );
}

function FlameBadge() {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(t);
  }, [t]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: 1 + t.value * 0.08 }, { rotate: `${(t.value - 0.5) * 8}deg` }] }));
  return (
    <Animated.View style={[js.flame, st]}>
      <Text style={{ fontSize: 36 }}>🔥</Text>
    </Animated.View>
  );
}

const js = StyleSheet.create({
  hero: { borderRadius: 24, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 16 },
  flame: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
  heroValue: { fontSize: 40, fontWeight: '900', color: '#FFFFFF', letterSpacing: -1, lineHeight: 44 },
  heroUnit: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginBottom: 7 },
  heroSub: { fontSize: 12.5, color: 'rgba(255,255,255,0.92)', marginTop: 2 },
  badge: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: P.card,
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#5D490F',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  badgeDone: { borderWidth: 1.5, borderColor: '#FFD54F' },
  badgeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F6F0E4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  badgeName: { fontSize: 14, fontWeight: '800', color: P.ink, textAlign: 'center' },
  badgeProgress: { fontSize: 12.5, color: P.muted, marginTop: 2 },
});

// ─── Health ──────────────────────────────────────────────────────────────────

function HealthPage() {
  const [data, setData] = useState<any>(null);
  const [version, setVersion] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [hp, me] = await Promise.all([profileApi.getHealthProfile<any>(), profileApi.me<MeProfile>()]);
      setData(hp);
      setVersion(me.version ?? me.profileVersion ?? 1);
      setHeight(hp?.latestMeasurements?.height?.value != null ? String(hp.latestMeasurements.height.value) : '');
      setWeight(hp?.latestMeasurements?.weight?.value != null ? String(hp.latestMeasurements.weight.value) : '');
    } catch (e) {
      setError(errMsg(e, 'Không tải được thông tin sức khỏe.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const h = height.trim() ? Number(height.replace(',', '.')) : null;
      const w = weight.trim() ? Number(weight.replace(',', '.')) : null;
      if (h != null && Number.isFinite(h)) await healthApi.createMeasurement({ type: 'HEIGHT_CM', value: h, unit: 'cm' });
      if (w != null && Number.isFinite(w)) await healthApi.createMeasurement({ type: 'WEIGHT_KG', value: w, unit: 'kg' });
      const updated = await profileApi.updateHealth(
        {
          heightCm: h != null && Number.isFinite(h) ? h : undefined,
          weightKg: w != null && Number.isFinite(w) ? w : undefined,
        },
        version,
      );
      setVersion((updated as any)?.profileVersion ?? version + 1);
      recordHealthMeasurementStore();
      setMsg('Đã cập nhật.');
      await load();
    } catch (e) {
      setError(errMsg(e, 'Không cập nhật được.'));
    } finally {
      setSaving(false);
    }
  };

  // Live BMI preview from the inputs; falls back to server value.
  const hNum = Number(height.replace(',', '.'));
  const wNum = Number(weight.replace(',', '.'));
  const liveBmi = hNum > 0 && wNum > 0 ? wNum / Math.pow(hNum / 100, 2) : null;
  const serverBmi = data?.bmi?.status === 'AVAILABLE' && data?.bmi?.value != null ? Number(data.bmi.value) : null;
  const bmiNum = liveBmi ?? serverBmi;
  const bmi = bmiNum != null ? bmiNum.toFixed(1).replace('.', ',') : '—';
  const bmiInfo = bmiCategory(bmiNum);
  const targetWeight = data?.targetWeight?.value != null ? String(data.targetWeight.value) : '—';
  const activity = activityLabel(data?.activityLevel);
  const targets = data?.dailyTargets;

  return (
    <PageScaffold
      footer={
        <PButton
          text={saving ? 'Đang cập nhật…' : 'Cập nhật thông tin'}
          onPress={save}
          disabled={saving}
          loading={saving}
        />
      }
    >
      <LoadBlock loading={loading} error={error && !data ? error : null} onRetry={load} skeleton="form">
        <InfoBanner
          emoji="🔒"
          title="Dữ liệu được bảo mật"
          body="Chỉ số giúp NOAN gợi ý món phù hợp hơn. NOAN không chia sẻ thông tin này với ai."
        />

        <SectionTitle title="Chỉ số cơ thể" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <PCard style={{ flex: 1, paddingVertical: 12 }}>
            <Text style={hs.inputLabel}>📏 Chiều cao</Text>
            <View style={hs.inputRow}>
              <PInput big value={height} onChangeText={setHeight} keyboardType="decimal-pad" placeholder="—" style={{ flex: 1 }} />
              <Text style={hs.unit}>cm</Text>
          </View>
          </PCard>
          <PCard style={{ flex: 1, paddingVertical: 12 }}>
            <Text style={hs.inputLabel}>⚖️ Cân nặng</Text>
            <View style={hs.inputRow}>
              <PInput big value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="—" style={{ flex: 1 }} />
              <Text style={hs.unit}>kg</Text>
          </View>
          </PCard>
          </View>

        <PCard delay={60}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={[hs.bmiCircle, { borderColor: bmiInfo.color }]}>
              <Text style={[hs.bmiValue, { color: bmiInfo.color }]}>{bmi}</Text>
              <Text style={hs.bmiLabel}>BMI</Text>
        </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: P.ink }}>{bmiInfo.label}</Text>
              <Text style={{ fontSize: 13, color: P.muted, marginTop: 3, lineHeight: 18 }}>{bmiInfo.hint}</Text>
              <View style={{ marginTop: 10 }}>
                <BmiScale value={bmiNum} />
      </View>
      </View>
          </View>
        </PCard>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <StatTile emoji="🎯" value={targetWeight} unit={targetWeight !== '—' ? 'kg' : undefined} label="Mục tiêu cân nặng" tint="orange" />
          <StatTile emoji="🏃" value={activity} label="Mức vận động" tint="blue" />
        </View>

        <SectionTitle title="Mục tiêu mỗi ngày" sub="NOAN tính từ chỉ số của bạn" />
        <PCard delay={120}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 }}>
            {[
              ['🔥', 'Năng lượng', targets?.energyKcal != null ? `${targets.energyKcal}` : '—', 'kcal'],
              ['🥩', 'Protein', targets?.proteinG != null ? `${targets.proteinG}` : '—', 'g'],
              ['💧', 'Nước', targets?.waterMl != null ? `${(targets.waterMl / 1000).toLocaleString('vi-VN')}` : '—', 'L'],
              ['👟', 'Bước chân', targets?.steps != null ? Number(targets.steps).toLocaleString('vi-VN') : '—', ''],
            ].map(([emoji, label, value, unit]) => (
              <View key={label} style={{ width: '50%', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={hs.targetEmoji}>
                  <Text style={{ fontSize: 18 }}>{emoji}</Text>
                </View>
            <View>
                  <Text style={{ fontSize: 12, color: P.muted }}>{label}</Text>
                  <Text style={{ fontSize: 17, fontWeight: '800', color: P.ink }}>
                    {value}
                    {value !== '—' && unit ? <Text style={{ fontSize: 12.5, color: P.muted, fontWeight: '700' }}> {unit}</Text> : null}
                  </Text>
            </View>
          </View>
            ))}
          </View>
        </PCard>

        {error ? <InlineNotice tone="error" text={error} /> : null}
        {msg ? <InlineNotice tone="success" text={msg} /> : null}
      </LoadBlock>
    </PageScaffold>
  );
}

function bmiCategory(bmi: number | null) {
  if (bmi == null || !Number.isFinite(bmi)) {
    return { label: 'Chưa có dữ liệu', hint: 'Nhập chiều cao và cân nặng để xem BMI.', color: P.faint };
  }
  if (bmi < 18.5) return { label: 'Thiếu cân', hint: 'Nên bổ sung thêm năng lượng và đạm trong bữa ăn.', color: '#3B82F6' };
  if (bmi < 23) return { label: 'Bình thường', hint: 'Tuyệt vời! Hãy duy trì chế độ ăn cân bằng.', color: '#16A34A' };
  if (bmi < 25) return { label: 'Thừa cân nhẹ', hint: 'Ưu tiên rau xanh, giảm đồ chiên và nước ngọt.', color: '#F59E0B' };
  return { label: 'Béo phì', hint: 'Nên tham khảo chuyên gia dinh dưỡng để có kế hoạch phù hợp.', color: '#E5402A' };
}

function BmiScale({ value }: { value: number | null }) {
  const segments = [
    { color: '#93C5FD', flex: 3.5 },
    { color: '#86EFAC', flex: 4.5 },
    { color: '#FCD34D', flex: 2 },
    { color: '#FCA5A5', flex: 5 },
  ];
  const min = 15;
  const max = 30;
  const pct = value != null ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)) : null;
  return (
    <View>
      <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2 }}>
        {segments.map((s, i) => (
          <View key={i} style={{ flex: s.flex, backgroundColor: s.color }} />
        ))}
        </View>
      {pct != null ? (
        <View style={{ position: 'absolute', left: `${pct}%`, top: -3, marginLeft: -7 }}>
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: P.ink, borderWidth: 2.5, borderColor: '#FFFFFF' }} />
            </View>
      ) : null}
        </View>
  );
}

const hs = StyleSheet.create({
  inputLabel: { fontSize: 13, fontWeight: '700', color: P.muted },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 4 },
  unit: { fontSize: 14, fontWeight: '700', color: P.muted, marginBottom: 8 },
  bmiCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDF7',
  },
  bmiValue: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  bmiLabel: { fontSize: 10.5, fontWeight: '800', color: P.muted, letterSpacing: 1 },
  targetEmoji: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#FFF6DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ─── Preferences ─────────────────────────────────────────────────────────────

function PreferencesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(1);
  const [goals, setGoals] = useState<CatalogItem[]>([]);
  const [tastes, setTastes] = useState<CatalogItem[]>([]);
  const [diets, setDiets] = useState<CatalogItem[]>([]);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [tasteIds, setTasteIds] = useState<string[]>([]);
  const [dietIds, setDietIds] = useState<string[]>([]);
  const [priorities, setPriorities] = useState<Record<string, boolean>>({
    HEALTHY: false,
    ECONOMY: false,
    QUICK: false,
    NOVELTY: false,
  });
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [me, catalog] = await Promise.all([profileApi.me<MeProfile>(), onboardingApi.catalog()]);
      setVersion(me.version ?? me.profileVersion ?? 1);
      setGoals(catalog.goals ?? []);
      setTastes(catalog.dietaryPreferences?.taste ?? []);
      setDiets(catalog.dietaryPreferences?.diet ?? []);
      setGoalId(me.preferences?.primaryGoal?.id ?? null);
      setTasteIds((me.preferences?.tastePreferences ?? []).map((x) => x.id));
      setDietIds((me.preferences?.dietTypes ?? []).map((x) => x.id));
      const pri: Record<string, boolean> = { HEALTHY: false, ECONOMY: false, QUICK: false, NOVELTY: false };
      for (const p of me.preferences?.selectionPriorities ?? []) {
        if (p.code in pri) pri[p.code] = (p.weight ?? 0) > 0.3;
      }
      setPriorities(pri);
    } catch (e) {
      setError(errMsg(e, 'Không tải được sở thích.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const updated = await profileApi.updatePreferences(
        { primaryGoalId: goalId ?? undefined, dietaryPreferenceIds: [...tasteIds, ...dietIds] },
        version,
      );
      setVersion((updated as any)?.profileVersion ?? (updated as any)?.version ?? version + 1);
      recordPreferencesUpdatedStore();
      setMsg('Đã lưu thay đổi.');
    } catch (e) {
      setError(errMsg(e, 'Không lưu được sở thích.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleId = (list: string[], id: string, setList: (v: string[]) => void) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const activePriorities = Object.entries(priorities).filter(([, v]) => v).length;

  return (
    <PageScaffold
      footer={<PButton text={saving ? 'Đang lưu…' : 'Lưu thay đổi'} onPress={save} disabled={saving} loading={saving} />}
    >
      <LoadBlock loading={loading} error={error && goals.length === 0 ? error : null} onRetry={load} skeleton="form">
        <SectionTitle title="Mục tiêu chính" sub="Chọn một" />
        <ChoiceGrid items={goals} selected={goalId ? [goalId] : []} onToggle={(id) => setGoalId(goalId === id ? null : id)} emoji="🎯" />

        <SectionTitle title="Khẩu vị yêu thích" sub={tasteIds.length ? `Đã chọn ${tasteIds.length}` : 'Chọn nhiều'} />
        <ChoiceChips items={tastes} selected={tasteIds} onToggle={(id) => toggleId(tasteIds, id, setTasteIds)} />

        <SectionTitle title="Ẩm thực yêu thích" sub={dietIds.length ? `Đã chọn ${dietIds.length}` : 'Chọn nhiều'} />
        <ChoiceChips items={diets} selected={dietIds} onToggle={(id) => toggleId(dietIds, id, setDietIds)} />

        <SectionTitle title="Ưu tiên khi chọn món" sub={activePriorities ? `${activePriorities} ưu tiên đang bật` : undefined} />
        <InfoBanner emoji="ℹ️" body="Ưu tiên được NOAN học từ cách bạn dùng app. Phần này chỉ để xem, chưa chỉnh được." tint="blue" />
        <PCard noPadding>
          <PToggleRow icon={HeartPulse} tint="green" title="Lành mạnh" value={priorities.HEALTHY} disabled />
          <PToggleRow icon={Wallet} tint="yellow" title="Tiết kiệm" value={priorities.ECONOMY} disabled />
          <PToggleRow icon={Zap} tint="orange" title="Nhanh gọn" value={priorities.QUICK} disabled />
          <PToggleRow icon={Sparkles} tint="purple" title="Thử món mới" value={priorities.NOVELTY} disabled last />
        </PCard>

        {error ? <InlineNotice tone="error" text={error} /> : null}
        {msg ? <InlineNotice tone="success" text={msg} /> : null}
      </LoadBlock>
    </PageScaffold>
  );
}

function ChoiceGrid({
  items,
  selected,
  onToggle,
  emoji,
}: {
  items: CatalogItem[];
  selected: string[];
  onToggle: (id: string) => void;
  emoji?: string;
}) {
  if (items.length === 0) {
  return (
      <PCard>
        <Text style={{ color: P.muted, textAlign: 'center' }}>Chưa có lựa chọn.</Text>
      </PCard>
    );
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {items.map((x) => {
        const active = selected.includes(x.id);
        return (
          <Pressable
            key={x.id}
            onPress={() => onToggle(x.id)}
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [ps.gridItem, active && ps.gridItemActive, pressed && { transform: [{ scale: 0.97 }] }]}
          >
            {active ? (
              <View style={ps.gridCheck}>
                <Check size={12} color="#FFFFFF" strokeWidth={3} />
              </View>
            ) : null}
            {emoji ? <Text style={{ fontSize: 20 }}>{emoji}</Text> : null}
            <Text style={[ps.gridTxt, active && { color: P.accentDeep }]} numberOfLines={2}>
              {x.name}
            </Text>
            {x.description ? (
              <Text style={ps.gridDesc} numberOfLines={2}>
                {x.description}
              </Text>
            ) : null}
      </Pressable>
        );
      })}
    </View>
  );
}

function ChoiceChips({
  items,
  selected,
  onToggle,
}: {
  items: CatalogItem[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (items.length === 0) {
  return (
      <PCard>
        <Text style={{ color: P.muted, textAlign: 'center' }}>Chưa có lựa chọn.</Text>
      </PCard>
    );
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {items.map((x) => (
        <PChip key={x.id} text={x.name} active={selected.includes(x.id)} onPress={() => onToggle(x.id)} check />
      ))}
    </View>
  );
}

const ps = StyleSheet.create({
  gridItem: {
    width: '48%',
    flexGrow: 1,
    minHeight: 84,
    backgroundColor: P.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 4,
    shadowColor: '#5D490F',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  gridItemActive: { backgroundColor: '#FFF8E1', borderColor: P.accent },
  gridCheck: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: P.accentDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridTxt: { fontSize: 14.5, fontWeight: '800', color: P.ink, marginTop: 2 },
  gridDesc: { fontSize: 12, color: P.muted, lineHeight: 16 },
});

// ─── Avoid ingredients ───────────────────────────────────────────────────────

type AvoidItem = {
  name: string;
  ingredientId?: string | null;
  mode?: 'HARD' | 'SOFT';
};

const AVOID_EMOJI: Record<string, string> = {
  'trứng': '🥚',
  'gluten': '🌾',
  'đậu nành': '🫘',
  'nấm': '🍄',
  'thịt bò': '🥩',
  'thịt heo': '🥓',
  'sữa': '🥛',
  'đậu phộng': '🥜',
  'hải sản': '🦐',
  'tôm': '🦐',
  'cua': '🦀',
  'cá': '🐟',
  'lúa mì': '🌾',
  'mè': '🌰',
  'hạt': '🌰',
};
function avoidEmoji(name: string) {
  const k = name.trim().toLowerCase();
  for (const key of Object.keys(AVOID_EMOJI)) if (k.includes(key)) return AVOID_EMOJI[key];
  return '🚫';
}

function AvoidPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tags, setTags] = useState<AvoidItem[]>([]);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<IngredientItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ name: string; id?: string }>>([
    { name: 'Trứng' },
    { name: 'Gluten' },
    { name: 'Đậu nành' },
    { name: 'Nấm' },
    { name: 'Thịt bò' },
    { name: 'Thịt heo' },
  ]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [me, allergens] = await Promise.all([
        profileApi.me<MeProfile>(),
        ingredientsApi.getAllergens().catch(() => []),
      ]);
      const avoided: AvoidItem[] = (me.preferences?.avoidedIngredients ?? [])
        .map((x) => ({
          name: (x.name ?? x.ingredientName ?? x.text ?? '').trim(),
          ingredientId: x.ingredientId ?? null,
          mode: (x as any).mode ?? 'HARD',
        }))
        .filter((x) => Boolean(x.name));
      setTags(avoided);

      if (Array.isArray(allergens) && allergens.length > 0) {
        const topAllergens = allergens
          .filter((a) => a.active !== false && a.code !== 'OTHER' && a.code !== 'SEAFOOD')
          .slice(0, 6)
          .map((a) => ({ name: a.name }));
        const combined: Array<{ name: string; id?: string }> = [...topAllergens];
        for (const extra of [{ name: 'Nấm' }, { name: 'Thịt bò' }, { name: 'Thịt heo' }]) {
          if (!combined.some((c) => c.name.toLowerCase() === extra.name.toLowerCase())) combined.push(extra);
        }
        setSuggestions(combined.slice(0, 8));
      }
    } catch (e) {
      setError(errMsg(e, 'Không tải được danh sách tránh.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await ingredientsApi.search(q, 8);
        if (!cancelled) setSearchResults(Array.isArray(results) ? results : []);
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const has = (name: string) => tags.some((x) => x.name.toLowerCase() === name.trim().toLowerCase());
  const addTag = (name: string, ingredientId?: string | null) => {
    const cleanName = name.trim();
    if (!cleanName || has(cleanName)) return;
    setTags((prev) => [...prev, { name: cleanName, ingredientId: ingredientId ?? null, mode: 'HARD' }]);
    setQuery('');
    setSearchResults([]);
  };
  const removeTag = (name: string) =>
    setTags((prev) => prev.filter((t) => t.name.toLowerCase() !== name.toLowerCase()));
  const toggleTag = (name: string, ingredientId?: string | null) =>
    has(name) ? removeTag(name.trim()) : addTag(name, ingredientId);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      await profileApi.putAvoidances({
        items: tags.map((t) => ({ text: t.name, ingredientId: t.ingredientId ?? undefined, mode: t.mode ?? 'HARD' })),
      });
      setMsg('Đã lưu danh sách nguyên liệu cần tránh.');
      recordAvoidancesUpdatedStore();
    } catch (e) {
      setError(errMsg(e, 'Không lưu được.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageScaffold
      footer={
        <PButton
          text={saving ? 'Đang lưu…' : tags.length ? `Lưu ${tags.length} lựa chọn` : 'Lưu'}
          onPress={save}
          disabled={saving}
          loading={saving}
        />
      }
    >
      <LoadBlock loading={loading} error={error && tags.length === 0 ? error : null} onRetry={load} skeleton="form">
        <InfoBanner emoji="🛡️" body="NOAN sẽ tự loại các món có chứa nguyên liệu bạn chọn khỏi gợi ý và Random." />

        <PSearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Tìm hoặc nhập nguyên liệu…"
          onSubmit={() => addTag(query)}
          right={
            isSearching ? (
              <ActivityIndicator size="small" color={P.accentDeep} />
            ) : query.trim() ? (
              <Pressable onPress={() => addTag(query)} hitSlop={8} accessibilityLabel="Thêm nguyên liệu" style={as.addBtn}>
                <Plus color={P.ink} size={16} strokeWidth={2.5} />
            </Pressable>
            ) : undefined
          }
        />

        {searchResults.length > 0 ? (
          <PCard noPadding style={{ marginTop: -6 }}>
            {searchResults.map((item, idx) => {
              const isSelected = has(item.name);
  return (
                <Pressable
                  key={item.id || idx}
                  onPress={() => toggleTag(item.name, item.id)}
                  style={({ pressed }) => [as.resultRow, idx < searchResults.length - 1 && as.resultDivider, pressed && { backgroundColor: '#FFFBF2' }]}
                >
                  <Text style={{ fontSize: 20 }}>{avoidEmoji(item.name)}</Text>
      <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: P.ink }}>{item.name}</Text>
                    {item.allergenCode ? (
                      <Text style={{ fontSize: 12, color: P.accentDeep, marginTop: 1 }}>Nhóm dị ứng: {item.allergenCode}</Text>
                    ) : null}
      </View>
                  <View style={[as.resultAction, isSelected && { backgroundColor: P.ink }]}>
                    {isSelected ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : <Plus size={14} color={P.ink} strokeWidth={2.5} />}
                  </View>
                </Pressable>
              );
            })}
          </PCard>
        ) : null}

        <SectionTitle title="Đang tránh" sub={tags.length ? `${tags.length} nguyên liệu · chạm để bỏ` : undefined} />
        {tags.length === 0 ? (
          <PCard>
            <EmptyBlock emoji="🥗" title="Chưa chọn nguyên liệu nào" body="Tìm ở trên hoặc chọn nhanh từ gợi ý bên dưới." />
          </PCard>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {tags.map((x) => (
              <Animated.View key={x.name} entering={FadeInDown.duration(220)}>
                <Pressable onPress={() => removeTag(x.name)} style={({ pressed }) => [as.tag, pressed && { opacity: 0.7 }]}>
                  <Text style={{ fontSize: 15 }}>{avoidEmoji(x.name)}</Text>
                  <Text style={as.tagTxt}>{x.name}</Text>
                  <View style={as.tagX}>
                    <X size={11} color="#FFFFFF" strokeWidth={3} />
          </View>
                </Pressable>
              </Animated.View>
        ))}
      </View>
        )}

        <SectionTitle title="Gợi ý phổ biến" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {suggestions.map((x, i) => {
            const isSelected = has(x.name);
  return (
              <Animated.View key={x.name} entering={FadeInDown.delay(60 + i * 40).duration(320)} style={{ width: '48%', flexGrow: 1 }}>
                <Pressable
                  onPress={() => toggleTag(x.name, x.id)}
                  style={({ pressed }) => [as.suggest, isSelected && as.suggestActive, pressed && { transform: [{ scale: 0.97 }] }]}
                >
                  <View style={[as.suggestEmoji, isSelected && { backgroundColor: '#FFE08A' }]}>
                    <Text style={{ fontSize: 20 }}>{avoidEmoji(x.name)}</Text>
            </View>
                  <Text style={[as.suggestTxt, isSelected && { color: P.accentDeep }]} numberOfLines={1}>
                    {x.name}
                  </Text>
                  {isSelected ? <Check size={18} color={P.accentDeep} strokeWidth={2.5} /> : <Plus size={18} color={P.faint} />}
          </Pressable>
              </Animated.View>
        );
      })}
    </View>

        {error ? <InlineNotice tone="error" text={error} /> : null}
        {msg ? <InlineNotice tone="success" text={msg} /> : null}
      </LoadBlock>
    </PageScaffold>
  );
}

const as = StyleSheet.create({
  addBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: P.accent, alignItems: 'center', justifyContent: 'center' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  resultDivider: { borderBottomWidth: 1, borderBottomColor: '#F6EFE2' },
  resultAction: { width: 28, height: 28, borderRadius: 14, backgroundColor: P.accentSoft, alignItems: 'center', justifyContent: 'center' },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 10,
    paddingRight: 6,
    height: 38,
    borderRadius: 19,
    backgroundColor: P.ink,
  },
  tagTxt: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  tagX: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  suggest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: P.card,
    borderRadius: 16,
    padding: 10,
    paddingRight: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: '#5D490F',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  suggestActive: { backgroundColor: '#FFF8E1', borderColor: P.accent },
  suggestEmoji: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#F6F0E4', alignItems: 'center', justifyContent: 'center' },
  suggestTxt: { flex: 1, fontSize: 14.5, fontWeight: '700', color: P.ink },
});

// ─── Saved dishes ────────────────────────────────────────────────────────────

function SavedPage({ onOpenDish }: { onOpenDish?: (dishId: string, title?: string) => void }) {
  const [query, setQuery] = useState('');
  const [qApplied, setQApplied] = useState('');

  const { data: items = [], isLoading, error: queryError, refetch } = useQuery({
    queryKey: ['profile', 'savedDishes', qApplied],
    queryFn: async () => {
      const res = await dishesApi.getSaved(undefined, 40, qApplied || undefined);
      return (res.data ?? (res as any).items ?? []) as SavedDishItem[];
    },
    staleTime: 0,
  });

  useEffect(() => {
    void refetch();
  }, [refetch, qApplied]);

  const loading = isLoading && items.length === 0;
  const error = queryError ? errMsg(queryError, 'Không tải được món đã lưu.') : null;

  return (
    <PageScaffold gap={10}>
      <PSearchBar
        value={query}
        onChangeText={(t) => {
          setQuery(t);
          if (!t) setQApplied('');
        }}
        placeholder="Tìm trong món đã lưu…"
        onSubmit={() => setQApplied(query.trim())}
      />
      <LoadBlock
        loading={loading}
        error={error}
        onRetry={() => void refetch()}
        empty={!loading && !error && items.length === 0}
        emptyText={qApplied ? 'Không tìm thấy món nào' : 'Chưa có món đã lưu'}
        emptyEmoji="🔖"
        skeleton="saved"
      >
        <SectionTitle title={`${items.length} món`} sub={qApplied ? `Kết quả cho “${qApplied}”` : 'Chạm để xem chi tiết'} />
        {items.map((row, i) => {
          const dish = row.dish ?? (row as any);
          const dishId = dish?.id ?? row.dishId;
          const kcal = dish.kcal ?? dish.nutrition?.calories ?? dish.calories;
          const minutes = dish.cookTimeMinutes ?? dish.prepMinutes ?? dish.cookMinutes;
          const price = formatPriceRange(dish.priceMin, dish.priceMax);
          const chips = [
            kcal != null ? `🔥 ${kcal} kcal` : null,
            minutes != null ? `⏱ ${minutes} phút` : null,
            price ? `💰 ${price}` : null,
          ].filter(Boolean) as string[];
          return (
            <Animated.View key={row.id ?? dish.id} entering={FadeInDown.delay(Math.min(i, 8) * 40).duration(320)}>
              <FoodRow
                image={dishImageSource(dish.thumbnailUrl ?? (dish as any).imageUrl, dish.media)}
                name={dish.name ?? 'Món ăn'}
                chips={chips}
                onPress={dishId ? () => onOpenDish?.(dishId, dish?.name) : undefined}
              />
            </Animated.View>
          );
        })}
      </LoadBlock>
    </PageScaffold>
  );
}

// ─── Privacy & security ──────────────────────────────────────────────────────

function PrivacyPage() {
  const [settings, setSettings] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setActionError(null);
    try {
      const [s, sess] = await Promise.all([
        profileApi.getSettings<any>(),
        authApi.getSessions().catch(() => ({ items: [] })),
      ]);
      setSettings(s);
      setSessions(sess.items ?? []);
    } catch (e) {
      setError(errMsg(e, 'Không tải được quyền riêng tư.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (body: Record<string, unknown>) => {
    if (!settings) return;
    setBusy(true);
    setMsg(null);
    setActionError(null);
    try {
      const next = await profileApi.updateSettings(body, settings.version ?? 1);
      setSettings(next);
      setMsg('Đã cập nhật.');
    } catch (e) {
      setActionError(errMsg(e, 'Không cập nhật được.'));
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMsg(null);
    setActionError(null);
    try {
      await fn();
      setMsg(ok);
    } catch (e) {
      setActionError(errMsg(e, 'Thao tác thất bại.'));
    } finally {
      setBusy(false);
    }
  };

  const pwdStrength = passwordStrength(pwdNew);

  return (
    <PageScaffold>
      <LoadBlock loading={loading} error={error} onRetry={load} skeleton="form">
        <SectionTitle title="Bảo mật tài khoản" />
        <PCard noPadding delay={0}>
          <PRow
            icon={LockKeyhole}
            tint="yellow"
            title="Đổi mật khẩu"
            sub={showPwd ? 'Nhập mật khẩu hiện tại và mật khẩu mới' : 'Nên đổi định kỳ để an toàn hơn'}
            onPress={() => setShowPwd((v) => !v)}
            right={<ChevronDown size={18} color={P.faint} style={{ transform: [{ rotate: showPwd ? '180deg' : '0deg' }] }} />}
          />
          {showPwd ? (
            <Animated.View entering={FadeInDown.duration(240)} style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>
              <View style={pv.pwdInput}>
                <PInput placeholder="Mật khẩu hiện tại" secureTextEntry value={pwdCurrent} onChangeText={setPwdCurrent} style={{ fontWeight: '500' }} />
              </View>
              <View style={pv.pwdInput}>
                <PInput placeholder="Mật khẩu mới (tối thiểu 8 ký tự)" secureTextEntry value={pwdNew} onChangeText={setPwdNew} style={{ fontWeight: '500' }} />
              </View>
              {pwdNew ? (
                <View style={{ gap: 4 }}>
                  <ProgressBar pct={pwdStrength.pct} color={pwdStrength.color} height={6} />
                  <Text style={{ fontSize: 12, color: pwdStrength.color, fontWeight: '700' }}>{pwdStrength.label}</Text>
                </View>
              ) : null}
              <PButton
                text={busy ? 'Đang đổi…' : 'Xác nhận đổi mật khẩu'}
                variant="dark"
                disabled={busy || !pwdCurrent || pwdNew.length < 8}
                loading={busy}
                onPress={() =>
                  runAction(async () => {
                    await authApi.changePassword(pwdCurrent, pwdNew);
                    setPwdCurrent('');
                    setPwdNew('');
                    setShowPwd(false);
                  }, 'Đã đổi mật khẩu.')
                }
              />
            </Animated.View>
          ) : null}
          <PRow
            icon={Users}
            tint="blue"
            title="Thiết bị đã đăng nhập"
            sub={sessions.length > 1 ? 'Chạm để đăng xuất các thiết bị khác' : 'Chỉ có thiết bị này'}
            value={`${sessions.length}`}
            last
            onPress={
              sessions.length > 1
                ? () =>
                    confirmAction(
                      'Đăng xuất thiết bị khác?',
                      'Các phiên đăng nhập khác sẽ bị hủy. Phiên hiện tại vẫn giữ.',
                      () => void runAction(() => authApi.deleteAllSessionsExceptCurrent(), 'Đã đăng xuất các thiết bị khác.'),
                      'Đăng xuất hết',
                    )
                : undefined
            }
          />
        </PCard>

        <SectionTitle title="Quyền riêng tư" />
        <PCard noPadding delay={60}>
          <PToggleRow
            icon={Globe2}
            tint="green"
            title="Hồ sơ công khai"
            sub="Người khác có thể xem trang cá nhân của bạn"
            value={(settings?.privacy?.profileVisibility ?? 'PUBLIC') === 'PUBLIC'}
            disabled={busy}
            onChange={(v) => patch({ profileVisibility: v ? 'PUBLIC' : 'PRIVATE' })}
          />
          <PToggleRow
            icon={Utensils}
            tint="orange"
            title="Hiển thị hoạt động ăn uống"
            sub="Chuỗi ngày và bữa đã ghi trên hồ sơ"
            value={!!settings?.privacy?.showDietActivity}
            disabled={busy}
            onChange={(v) => patch({ showDietActivity: v })}
          />
          <PToggleRow
            icon={MessageCircle}
            tint="blue"
            title="Cho phép bình luận"
            sub="Trên bài viết của bạn"
            value={settings?.privacy?.allowComments !== false}
            disabled={busy}
            onChange={(v) => patch({ allowComments: v })}
            last
          />
        </PCard>

        <SectionTitle title="Dữ liệu của bạn" />
        <PCard noPadding delay={120}>
          <PRow
            icon={FileText}
            tint="purple"
            title="Tải dữ liệu của tôi"
            sub="Nhận bản sao toàn bộ dữ liệu qua email"
            onPress={() => runAction(() => profileApi.requestDataExport(), 'Đã tạo yêu cầu xuất dữ liệu.')}
          />
          <PRow
            icon={History}
            tint="gray"
            title="Xóa lịch sử Random"
            onPress={() =>
              confirmAction(
                'Xóa lịch sử Random?',
                'Toàn bộ lịch sử Random sẽ bị xóa và không hoàn tác được.',
                () =>
                  void runAction(async () => {
                    await profileApi.clearHistory();
                    void queryClient.invalidateQueries({ queryKey: ['profile', 'randomHistory'] });
                    void queryClient.invalidateQueries({ queryKey: PROFILE_DASHBOARD_QUERY_KEY });
                  }, 'Đã xóa lịch sử Random.'),
                'Xóa',
              )
            }
          />
          <PRow
            icon={HeartPulse}
            tint="gray"
            title="Xóa dữ liệu sức khỏe"
            last
            onPress={() =>
              confirmAction(
                'Xóa dữ liệu sức khỏe?',
                'Các chỉ số và dữ liệu sức khỏe đã lưu sẽ bị xóa.',
                () =>
                  void runAction(async () => {
                    await profileApi.clearHealth();
                    recordHealthMeasurementStore();
                  }, 'Đã xóa dữ liệu sức khỏe.'),
                'Xóa',
              )
            }
          />
        </PCard>

        {actionError ? <InlineNotice tone="error" text={actionError} /> : null}
        {msg ? <InlineNotice tone="success" text={msg} /> : null}

        <SectionTitle title="Vùng nguy hiểm" />
        <PCard noPadding style={{ borderWidth: 1, borderColor: '#FFD6CF' }}>
          <PRow
            icon={Trash2}
            danger
            title="Xóa tài khoản"
            sub="Gửi yêu cầu xóa vĩnh viễn tài khoản và dữ liệu"
            last
            onPress={
              busy
                ? undefined
                : () =>
                    confirmAction(
                      'Xóa tài khoản?',
                      'Yêu cầu xóa tài khoản sẽ được gửi. Hành động này có thể không hoàn tác.',
                      () => void runAction(() => profileApi.requestAccountDeletion(), 'Đã gửi yêu cầu xóa tài khoản.'),
                      'Gửi yêu cầu',
                    )
            }
          />
        </PCard>
      </LoadBlock>
    </PageScaffold>
  );
}

function passwordStrength(pwd: string) {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { pct: 25, label: 'Yếu', color: '#E5402A' };
  if (score <= 3) return { pct: 60, label: 'Khá', color: '#F59E0B' };
  return { pct: 100, label: 'Mạnh', color: '#16A34A' };
}

const pv = StyleSheet.create({
  pwdInput: {
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FBF6EC',
    borderWidth: 1,
    borderColor: P.line,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
});

// ─── Random history ──────────────────────────────────────────────────────────

function HistoryPage({ onOpenDish }: { onOpenDish?: (dishId: string, title?: string) => void }) {
  const [filter, setFilter] = useState<'ALL' | 'SELECTED' | 'SKIPPED'>('ALL');
  const { data, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ['profile', 'randomHistory'],
    queryFn: async () => {
      const [sum, hist] = await Promise.all([dishesApi.getRandomHistorySummary(), dishesApi.getRandomHistory(30)]);
      return { summary: sum, items: (hist.data ?? (hist as any).items ?? []) as any[] };
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const summary = data?.summary ?? null;
  const items = data?.items ?? [];
  const loading = isLoading && !data;
  const error = queryError ? errMsg(queryError, 'Không tải được lịch sử Random.') : null;

  const total = summary?.totalRuns ?? 0;
  const selected = summary?.selectedCount ?? 0;
  const skipped = summary?.skippedCount ?? Math.max(total - selected, 0);
  const rate = total > 0 ? Math.round((selected / total) * 100) : 0;

  const isSel = (row: any) => row.isSelected || row.outcome === 'SELECTED';
  const visible = items.filter((r) => (filter === 'ALL' ? true : filter === 'SELECTED' ? isSel(r) : !isSel(r)));

  // Group rows by local day for readable timeline.
  const groups = groupByDay(visible);

  return (
    <PageScaffold gap={12}>
      <LoadBlock
        loading={loading}
        error={error}
        onRetry={() => void refetch()}
        empty={!loading && !error && items.length === 0 && total === 0}
        emptyText="Chưa có lần Random nào"
        emptyEmoji="🎲"
        skeleton="history"
      >
        <Animated.View entering={FadeInDown.duration(380)}>
          <LinearGradient colors={['#2A1A10', '#4A3225']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={rs.hero}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={rs.heroDice}>
                <Text style={{ fontSize: 30 }}>🎲</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={rs.heroLabel}>Tổng số lần Random</Text>
                <Text style={rs.heroValue}>{total}</Text>
              </View>
              <View style={rs.rateRing}>
                <Text style={rs.rateValue}>{rate}%</Text>
                <Text style={rs.rateLabel}>chọn</Text>
              </View>
            </View>
            <View style={rs.heroStats}>
              <View style={{ flex: 1 }}>
                <Text style={rs.heroStatValue}>{selected}</Text>
                <Text style={rs.heroStatLabel}>✅ Đã chọn ăn</Text>
              </View>
              <View style={rs.heroStatDivider} />
              <View style={{ flex: 1 }}>
                <Text style={rs.heroStatValue}>{skipped}</Text>
                <Text style={rs.heroStatLabel}>🔁 Random lại</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        <PTabs
          tabs={[
            { key: 'ALL', label: 'Tất cả', count: items.length },
            { key: 'SELECTED', label: 'Đã chọn', count: items.filter(isSel).length },
            { key: 'SKIPPED', label: 'Random lại', count: items.filter((r) => !isSel(r)).length },
          ]}
          value={filter}
          onChange={setFilter}
        />

        {visible.length === 0 ? (
          <PCard>
            <EmptyBlock emoji="🍽️" title="Không có mục nào" body="Thử đổi bộ lọc ở trên." />
          </PCard>
        ) : (
          groups.map((g, gi) => (
            <View key={g.key} style={{ gap: 10 }}>
              <Text style={rs.dayLabel}>{g.label}</Text>
              {g.rows.map((row, i) => {
                const dish = row.dish;
                const dishId = dish?.id ?? row.dishId;
                const sel = isSel(row);
                return (
                  <Animated.View key={row.id} entering={FadeInDown.delay(Math.min(gi * 3 + i, 8) * 40).duration(300)}>
                    <FoodRow
                      image={dishImageSource(dish?.imageUrl, dish?.media)}
                      name={dish?.name ?? 'Món không còn khả dụng'}
                      meta={formatClock(row.createdAt)}
                      badge={{ text: sel ? 'Đã chọn' : 'Random lại', variant: sel ? 'success' : 'muted' }}
                      onPress={dishId ? () => onOpenDish?.(dishId, dish?.name) : undefined}
                    />
                  </Animated.View>
                );
              })}
            </View>
          ))
        )}
      </LoadBlock>
    </PageScaffold>
  );
}

function groupByDay(rows: any[]) {
  const today = new Date();
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  const keyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const todayKey = keyOf(today);
  const yestKey = keyOf(yest);
  const map = new Map<string, { key: string; label: string; rows: any[] }>();
  for (const r of rows) {
    const d = new Date(r.createdAt);
    const valid = !Number.isNaN(d.getTime());
    const key = valid ? keyOf(d) : 'unknown';
    if (!map.has(key)) {
      const label = !valid
        ? 'Không rõ ngày'
        : key === todayKey
          ? 'Hôm nay'
          : key === yestKey
            ? 'Hôm qua'
            : d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' });
      map.set(key, { key, label: label.charAt(0).toUpperCase() + label.slice(1), rows: [] });
    }
    map.get(key)!.rows.push(r);
  }
  return Array.from(map.values());
}

function formatClock(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

const rs = StyleSheet.create({
  hero: { borderRadius: 24, padding: 18, gap: 16 },
  heroDice: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(255,201,40,0.18)', alignItems: 'center', justifyContent: 'center' },
  heroLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  heroValue: { fontSize: 36, fontWeight: '900', color: '#FFFFFF', letterSpacing: -1, lineHeight: 40 },
  rateRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: P.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateValue: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
  rateLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '700' },
  heroStats: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 12 },
  heroStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 12 },
  heroStatValue: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  heroStatLabel: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  dayLabel: { fontSize: 13, fontWeight: '800', color: P.muted, letterSpacing: 0.3, marginTop: 4 },
});

// ─── My posts ────────────────────────────────────────────────────────────────

function PostsPage() {
  const [tab, setTab] = useState<'ACTIVE' | 'DRAFT'>('ACTIVE');
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');

  const { data, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ['profile', 'myPosts', appliedQuery],
    queryFn: async () => {
      const [pub, draft] = await Promise.all([
        communityApi.listPosts({ scope: 'ME', status: 'ACTIVE', limit: 50, q: appliedQuery || undefined }),
        communityApi.listPosts({ scope: 'ME', status: 'DRAFT', limit: 50, q: appliedQuery || undefined }),
      ]);
      return { pubItems: (pub.data ?? []) as ExplorePost[], draftItems: (draft.data ?? []) as ExplorePost[] };
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  useEffect(() => {
    void refetch();
  }, [refetch, appliedQuery]);

  const pubItems = data?.pubItems ?? [];
  const draftItems = data?.draftItems ?? [];
  const posts = tab === 'ACTIVE' ? pubItems : draftItems;
  const loading = isLoading && !data;
  const error = queryError ? errMsg(queryError, 'Không tải được bài viết.') : null;
  const totalLikes = pubItems.reduce((a, p) => a + (p.likeCount ?? 0), 0);
  const totalComments = pubItems.reduce((a, p) => a + (p.commentCount ?? 0), 0);

  return (
    <PageScaffold gap={12}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <StatTile emoji="📝" value={pubItems.length} label="Đã đăng" tint="yellow" />
        <StatTile emoji="❤️" value={totalLikes} label="Lượt thích" tint="red" />
        <StatTile emoji="💬" value={totalComments} label="Bình luận" tint="blue" />
      </View>

      <PTabs
        tabs={[
          { key: 'ACTIVE', label: 'Đã đăng', count: pubItems.length },
          { key: 'DRAFT', label: 'Bản nháp', count: draftItems.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      <PSearchBar
        value={query}
        onChangeText={(t) => {
          setQuery(t);
          if (!t) setAppliedQuery('');
        }}
        placeholder="Tìm bài viết…"
        onSubmit={() => setAppliedQuery(query.trim())}
      />

      <LoadBlock
        loading={loading}
        error={error}
        onRetry={() => void refetch()}
        empty={!loading && !error && posts.length === 0}
        emptyText={tab === 'ACTIVE' ? 'Chưa có bài viết nào' : 'Chưa có bản nháp'}
        emptyEmoji={tab === 'ACTIVE' ? '📭' : '✏️'}
        skeleton="list"
      >
        {posts.map((p, i) => {
          const img = p.imageUrls?.[0];
          return (
            <Animated.View key={p.id} entering={FadeInDown.delay(Math.min(i, 8) * 40).duration(320)}>
              <PCard noPadding style={{ overflow: 'hidden' }}>
                {img ? <Image source={{ uri: img }} style={{ width: '100%', height: 190 }} resizeMode="cover" /> : null}
                <View style={{ padding: 14, gap: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <AvatarImage uri={p.author?.avatarUrl} size={36} seed={p.author?.displayName ?? p.id} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14.5, fontWeight: '800', color: P.ink }} numberOfLines={1}>
                        {p.author?.displayName ?? 'Bạn'}
                      </Text>
                      <Text style={{ fontSize: 12, color: P.muted }}>{formatRelTime(p.createdAt)}</Text>
                    </View>
                    <View style={[pz.status, tab === 'DRAFT' && { backgroundColor: '#F3EDE2' }]}>
                      <Text style={[pz.statusTxt, tab === 'DRAFT' && { color: P.muted }]}>
                        {tab === 'DRAFT' ? 'Bản nháp' : 'Đã đăng'}
                      </Text>
                    </View>
                  </View>
                  {p.content ? (
                    <Text style={{ fontSize: 15, color: P.ink, lineHeight: 22 }} numberOfLines={4}>
                      {p.content}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: 14, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#F6EFE2' }}>
                    <View style={pz.metric}>
                      <Heart size={15} color="#E5402A" fill={(p.likeCount ?? 0) > 0 ? '#E5402A' : 'transparent'} />
                      <Text style={pz.metricTxt}>{p.likeCount ?? 0}</Text>
                    </View>
                    <View style={pz.metric}>
                      <MessageCircle size={15} color={P.muted} />
                      <Text style={pz.metricTxt}>{p.commentCount ?? 0}</Text>
                    </View>
                  </View>
                </View>
              </PCard>
            </Animated.View>
          );
        })}
      </LoadBlock>
    </PageScaffold>
  );
}

const pz = StyleSheet.create({
  status: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: P.successSoft },
  statusTxt: { fontSize: 11.5, fontWeight: '800', color: P.success },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 6 },
  metricTxt: { fontSize: 13.5, fontWeight: '700', color: P.ink2 },
});

// ─── Shared list primitives ──────────────────────────────────────────────────

function FoodRow({
  image,
  name,
  meta,
  chips,
  badge,
  onPress,
}: {
  image: ImageSourcePropType;
  name: string;
  meta?: string;
  chips?: string[];
  badge?: { text: string; variant?: 'success' | 'muted' | 'warning' };
  onPress?: () => void;
}) {
  const badgeBg = badge?.variant === 'success' ? P.successSoft : badge?.variant === 'warning' ? '#FFF8E1' : '#F3EDE2';
  const badgeFg = badge?.variant === 'success' ? P.success : badge?.variant === 'warning' ? '#B78103' : P.muted;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`Xem chi tiết món ${name}`}
      style={({ pressed }) => [fr.row, pressed && { transform: [{ scale: 0.985 }], opacity: 0.95 }]}
    >
      <Image source={image} style={fr.img} resizeMode="cover" />
      <View style={{ flex: 1, justifyContent: 'center', gap: 5 }}>
        <Text numberOfLines={2} style={fr.name}>
          {name}
        </Text>
        {chips && chips.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {chips.map((c) => (
              <View key={c} style={fr.chip}>
                <Text style={fr.chipTxt}>{c}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {badge || meta ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {badge ? (
              <View style={[fr.badge, { backgroundColor: badgeBg }]}>
                {badge.variant === 'success' ? <Check size={11} color={badgeFg} strokeWidth={3} /> : null}
                <Text style={[fr.badgeTxt, { color: badgeFg }]}>{badge.text}</Text>
              </View>
            ) : null}
            {meta ? (
              <Text numberOfLines={1} style={fr.meta}>
                {meta}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      {onPress ? <ChevronRight size={18} color={P.faint} /> : null}
    </Pressable>
  );
}

const fr = StyleSheet.create({
  row: {
    backgroundColor: P.card,
    borderRadius: 20,
    padding: 10,
    paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#5D490F',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  img: { width: 84, height: 84, borderRadius: 16, backgroundColor: '#F5EEDB' },
  name: { fontSize: 15.5, fontWeight: '800', color: P.ink, lineHeight: 20 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: '#FBF6EC' },
  chipTxt: { fontSize: 11.5, fontWeight: '700', color: P.ink2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeTxt: { fontSize: 11.5, fontWeight: '800' },
  meta: { fontSize: 12.5, color: P.muted },
});

function MonthCalendar({ month, days }: { month: string; days: Array<{ localDate: string; status: string }> }) {
  const [y, m] = month.split('-').map(Number);
  const valid = Number.isFinite(y) && Number.isFinite(m);
  const label = valid ? `Tháng ${m}, ${y}` : month;
  const dayMap = new Map(days.map((d) => [d.localDate, d.status]));
  const daysInMonth = valid ? new Date(y, m, 0).getDate() : 31;
  // Monday-first offset
  const firstDow = valid ? (new Date(y, m - 1, 1).getDay() + 6) % 7 : 0;
  const todayIso = getTodayISO(getDeviceTimeZone());
  const cells: Array<number | null> = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const doneCount = days.filter((d) => isDoneStatus(d.status)).length;

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ fontSize: 17, fontWeight: '800', color: P.ink }}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: P.accent }} />
          <Text style={{ fontSize: 12.5, color: P.muted, fontWeight: '600' }}>{doneCount} ngày có bữa</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => (
          <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 11.5, fontWeight: '800', color: P.faint }}>
            {d}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 }}>
        {cells.map((d, i) => {
          if (d === null) return <View key={`e${i}`} style={{ width: `${100 / 7}%` }} />;
          const iso = `${month}-${String(d).padStart(2, '0')}`;
          const status = dayMap.get(iso) ?? 'EMPTY';
          const done = isDoneStatus(status);
          const partial = status === 'IN_PROGRESS';
          const isToday = iso === todayIso;
          const future = iso > todayIso;
          return (
            <View key={d} style={{ width: `${100 / 7}%`, alignItems: 'center' }}>
              <View
                style={[
                  cal.cell,
                  done && !partial && cal.cellDone,
                  partial && cal.cellPartial,
                  isToday && cal.cellToday,
                ]}
              >
                <Text style={[cal.cellTxt, done && { color: P.ink, fontWeight: '800' }, future && { color: P.faint }]}>{d}</Text>
                {done && !partial ? <Text style={{ fontSize: 8, marginTop: -1 }}>🍽️</Text> : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function isDoneStatus(status: string) {
  return status === 'QUALIFIED' || status === 'COMPLETED' || status === 'IN_PROGRESS';
}

const cal = StyleSheet.create({
  cell: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#FBF6EC', alignItems: 'center', justifyContent: 'center' },
  cellDone: { backgroundColor: P.accent },
  cellPartial: { backgroundColor: '#FFE9A8' },
  cellToday: { borderWidth: 2, borderColor: P.ink },
  cellTxt: { fontSize: 13, fontWeight: '600', color: P.ink2 },
});

