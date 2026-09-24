import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LiquidGlassBottomNav } from '../components/organisms/LiquidGlassBottomNav';
import { ImageUploadField, type UploadImage } from '../components/organisms/ImageUploadField';
import { AvatarImage } from '../components/organisms/AvatarImage';
import { profileApi, type ProfileDashboard } from '../services/api/profile';
import { useProfileDashboard, PROFILE_DASHBOARD_QUERY_KEY } from '../hooks/useProfileDashboard';
import { queryClient } from '../lib/query-client';
import { authApi } from '../services/api/auth';
import { clearSession } from '../services/api/storage';
import { dishesApi } from '../services/api/dishes';
import { healthApi } from '../services/api/health';
import { communityApi, type ExplorePost } from '../services/api/explore';
import { onboardingApi } from '../services/api/onboarding';
import { ingredientsApi, type IngredientItem } from '../services/api/ingredients';
import { normalizeImageUrl } from '../services/api/randomization';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { ScreenSlideTransition } from '../components/ui/screen-transition';
import { DateNavigator } from '../components/molecules/DateNavigator';
import { HealthDatePickerSheet } from '../components/organisms/HealthDatePickerSheet';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Textarea } from '../components/ui/textarea';
import { cn } from '../lib/utils';
import { uploadSignedImage, type SignedImageUpload } from '../services/uploads/signed-image';
import { getDeviceTimeZone, getTodayISO, parsePlanDate } from '../lib/dates';
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
  ArrowLeft,
  Bell,
  Bookmark,
  CalendarDays,
  Check,
  ChevronRight,
  Compass,
  Footprints,
  Globe2,
  HeartPulse,
  History,
  Home,
  Info,
  Leaf,
  LockKeyhole,
  MapPin,
  NotebookTabs,
  Pencil,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  UserRound,
  Volume2,
  X,
} from 'lucide-react-native';

// Color tokens (dùng cho inline style khi cần exact color)
const CLR = {
  yellow: '#FFD54F',
  yellowDark: '#F5BD18',
  ink: '#161616',
  secondary: '#747474',
  border: '#E8E4DC',
  danger: '#FF4D3D',
};

const dishPlaceholder = require('../assets/images/random/pho-result.jpg');

function errMsg(e: unknown, fallback = 'Đã xảy ra lỗi.') {
  return (e as { message?: string })?.message ?? fallback;
}

const GENDER_OPTIONS = ['Nam', 'Nữ', 'Khác', 'Không muốn nói'] as const;

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
  if (g === 'OTHER') return 'Khác';
  if (g === 'PREFER_NOT_TO_SAY') return 'Không muốn nói';
  return g ? String(g) : '—';
}

function parseGenderLabel(label: string): string | null {
  if (label === 'Nam') return 'MALE';
  if (label === 'Nữ') return 'FEMALE';
  if (label === 'Khác') return 'OTHER';
  if (label === 'Không muốn nói') return 'PREFER_NOT_TO_SAY';
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
      globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }
    ).process?.env?.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
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

  return (
    <SafeAreaView className="flex-1 bg-[#FFF9E8]" edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 168, gap: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor="#FFD54F"
            colors={['#FFD54F']}
          />
        }
      >
        <View className="h-[68px] flex-row items-center justify-between">
          <Text className="text-[32px] font-bold text-[#161616]" style={{ lineHeight: 40 }}>
            Cá nhân
          </Text>
          <View className="flex-row gap-1.5">
            <IconButton onPress={() => open('settings')} icon={Settings} />
            <IconButton onPress={onNotification} icon={Bell} />
          </View>
        </View>

        {isInitialLoading && !dash && <ProfileMainSkeleton />}

        {!dash && Boolean(errorMessage) && (
          <Card>
            <Text className="text-[#FF4D3D] text-center">{errorMessage}</Text>
            <Pressable
              className="mt-3 border border-[#F5BD18] rounded-[13px] px-3 py-2 self-center"
              onPress={() => void refetch()}
            >
              <Text className="text-[#D89A00]">Thử lại</Text>
            </Pressable>
          </Card>
        )}

        {dash ? (
          <>
            <Card>
              <View className="flex-row items-start gap-3.5">
                <AvatarImage uri={avatarUri} size={96} />
                <View className="flex-1 gap-2">
                  <View className="self-start flex-row items-center gap-[5px] bg-[#FFF8E6] px-2 py-1.5 rounded-[14px] max-w-full">
                    <Target size={17} color={CLR.yellowDark} />
                    <Text className="text-[11px] text-[#161616] flex-shrink" numberOfLines={2}>
                      Mục tiêu: {goalName}
                    </Text>
                  </View>
                  <Text className="text-[23px] font-bold text-[#161616]" numberOfLines={2}>
                    {displayName}
                  </Text>
                  <Text className="text-[15px] text-[#747474]">{username}</Text>
                  <Pressable
                    onPress={() => open('edit')}
                    className="border border-[#F5BD18] rounded-[13px] px-3 py-2 self-start"
                  >
                    <Text className="text-[#D89A00] text-[14px]">Chỉnh sửa hồ sơ</Text>
                  </Pressable>
                </View>
              </View>
              <View className="flex-row mt-[18px] pt-[14px] border-t border-[#E8E4DC]">
                {[
                  [String(dash.socialStats.publishedPostCount), 'Bài viết'],
                  [String(dash.socialStats.savedDishCount), 'Món đã lưu'],
                  [String(dash.socialStats.followerCount), 'Người theo dõi'],
                ].map(([v, l], i) => (
                  <View
                    key={l}
                    className={
                      i > 0
                        ? 'flex-1 items-center border-l border-[#E8E4DC]'
                        : 'flex-1 items-center'
                    }
                  >
                    <Text className="text-[19px] font-bold text-[#161616]">{v}</Text>
                    <Text className="text-[13px] text-[#747474] mt-0.5 text-center">{l}</Text>
                  </View>
                ))}
              </View>
            </Card>
            <Card>
              <View className="flex-row justify-between items-center">
                <Text className="text-[19px] font-bold text-[#161616]">Hành trình của bạn</Text>
                <Pressable onPress={() => open('journey')}>
                  <Text className="text-[15px] text-[#D99A00]">Chi tiết</Text>
                </Pressable>
              </View>
              <View className="flex-row mt-4">
                {[
                  [String(dash.journeyPreview.currentStreakDays), 'ngày liên tiếp'],
                  [String(dash.journeyPreview.mealsLoggedThisMonth), 'bữa đã ghi'],
                  [String(dash.journeyPreview.newDishesThisMonth), 'món mới'],
                ].map(([v, l], i) => (
                  <View
                    key={l}
                    className={
                      i > 0
                        ? 'flex-1 items-center border-l border-[#E8E4DC]'
                        : 'flex-1 items-center'
                    }
                  >
                    <Text className="text-[19px] font-bold text-[#161616]">{v}</Text>
                    <Text className="text-[13px] text-[#747474] mt-0.5 text-center">{l}</Text>
                  </View>
                ))}
              </View>
              <View className="mt-3.5 bg-[#FFF9E9] rounded-[16px] p-3 flex-row justify-between">
                {dash.journeyPreview.recentDays.map((day, i) => {
                  const done =
                    day.status === 'COMPLETED' || day.status === 'IN_PROGRESS';
                  return (
                    <View key={day.localDate} className="items-center gap-[5px]">
                      <View
                        className={
                          done
                            ? 'w-7 h-7 rounded-[14px] bg-[#FFD54F] items-center justify-center'
                            : 'w-7 h-7 rounded-[14px] border border-[#F5BD18] items-center justify-center'
                        }
                      >
                        {done && <Check size={18} color="#fff" strokeWidth={3} />}
                      </View>
                      <Text className="text-xs">{weekdayLabels[i] ?? ''}</Text>
                    </View>
                  );
                })}
              </View>
            </Card>
            <Text className="text-[20px] font-bold text-[#161616] my-1">Của bạn</Text>
            <View className="flex-row flex-wrap gap-2.5">
              <Shortcut
                icon={Bookmark}
                title="Món đã lưu"
                sub={`${dash.shortcuts.savedDishes} món`}
                onPress={() => open('saved')}
              />
              <Shortcut
                icon={Sparkles}
                title="Lịch sử Random"
                sub={`${dash.shortcuts.randomRuns} lần`}
                onPress={() => open('history')}
              />
              <Shortcut
                icon={NotebookTabs}
                title="Nhật ký bữa ăn"
                sub={monthLabel}
                onPress={() => open('diary')}
              />
              <Shortcut
                icon={Pencil}
                title="Bài viết của tôi"
                sub={`${dash.shortcuts.myPublishedPosts} bài`}
                onPress={() => open('posts')}
              />
            </View>
          </>
        ) : null}

        <Card noPadding>
          <Row icon={HeartPulse} title="Thông tin sức khỏe" onPress={() => open('health')} />
          <Row icon={Target} title="Mục tiêu & sở thích" onPress={() => open('preferences')} />
          <Row icon={Leaf} title="Nguyên liệu cần tránh" onPress={() => open('avoid')} />
          <Row
            icon={LockKeyhole}
            title="Cài đặt & quyền riêng tư"
            onPress={() => open('privacy')}
            last
          />
        </Card>
        <Pressable
          className="py-3"
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
          <Text className="text-[16px] text-[#FF4D3D] text-center">Đăng xuất</Text>
        </Pressable>
      </ScrollView>
      <LiquidGlassBottomNav active="profile" {...nav} />
    </SafeAreaView>
  );
}

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
      <SafeAreaView className="flex-1 bg-[#FBF9F5]" edges={['top', 'bottom']}>
        <MealJournalScreen onBack={onBack} onOpenDish={onOpenDish} />
      </SafeAreaView>
    );
  }

  const titles: Record<Exclude<Page, 'main'>, string> = {
    settings: 'Cài đặt',
    edit: 'Chỉnh sửa hồ sơ',
    journey: 'Hành trình của bạn',
    health: 'Thông tin sức khỏe',
    preferences: 'Mục tiêu & sở thích',
    avoid: 'Nguyên liệu cần tránh',
    saved: 'Món đã lưu',
    privacy: 'Cài đặt & quyền riêng tư',
    history: 'Lịch sử Random',
    posts: 'Bài viết của tôi',
    diary: 'Nhật ký bữa ăn',
  };
  return (
    <SafeAreaView className="flex-1 bg-[#FFF9E8]">
      <Header title={titles[page]} onBack={onBack} />
      <ScrollView
        contentContainerStyle={
          page === 'edit'
            ? { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 8 }
            : { padding: 20, paddingBottom: 44, gap: 16 }
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
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
      </ScrollView>
    </SafeAreaView>
  );
}

function LoadBlock({
  loading,
  error,
  onRetry,
  empty,
  emptyText,
  skeleton = 'form',
  children,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  empty?: boolean;
  emptyText?: string;
  skeleton?: 'edit' | 'form' | 'list' | 'journey' | 'history' | 'saved';
  children: ReactNode;
}) {
  if (loading) {
    if (skeleton === 'edit') return <ProfileEditSkeleton />;
    if (skeleton === 'history') return <RandomHistorySkeleton />;
    if (skeleton === 'saved') return <FoodListSkeleton count={5} />;
    if (skeleton === 'list') return <ListSkeleton rows={5} />;
    if (skeleton === 'journey') return <JourneySkeleton />;
    return <FormRowsSkeleton rows={5} />;
  }
  if (error) {
    return (
      <Card>
        <Text style={{ color: CLR.danger, textAlign: 'center' }}>{error}</Text>
        <Pressable
          onPress={onRetry}
          style={{
            marginTop: 12,
            alignSelf: 'center',
            borderWidth: 1,
            borderColor: '#F5BD18',
            borderRadius: 13,
            paddingHorizontal: 14,
            paddingVertical: 8,
          }}
        >
          <Text style={{ color: '#D89A00' }}>Thử lại</Text>
        </Pressable>
      </Card>
    );
  }
  if (empty) {
    return (
      <Card>
        <Text style={{ color: '#747474', textAlign: 'center', paddingVertical: 16 }}>
          {emptyText ?? 'Chưa có dữ liệu.'}
        </Text>
      </Card>
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
      const [profile, s] = await Promise.all([
        profileApi.me<MeProfile>(),
        profileApi.getSettings<any>(),
      ]);
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

  return (
    <LoadBlock loading={loading} error={error} onRetry={load} skeleton="form">
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <AvatarImage uri={avatarUri} size={80} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 23, fontWeight: '700', color: '#161616' }}>{name}</Text>
          <Text style={{ fontSize: 15, color: '#747474', marginTop: 3 }}>{username}</Text>
        </View>
        <ChevronRight />
      </Card>
      <Card noPadding>
        <Row
          icon={Bell}
          title="Thông báo"
          sub={
            settings?.notifications?.pushEnabled
              ? 'Bữa ăn, cộng đồng và nhắc nhở'
              : 'Đang tắt'
          }
        />
        <Row icon={Pencil} title="Giao diện" sub={themeLabel} />
        <Row icon={Globe2} title="Ngôn ngữ" sub={lang} />
        <Row
          icon={ShieldCheck}
          title="Đồng bộ dữ liệu"
          sub={settings?.privacy?.analyticsEnabled ? 'Đã bật' : 'Đang tắt'}
          last
        />
      </Card>
      <Card noPadding>
        <ToggleRow
          icon={Volume2}
          title="Thông báo đẩy"
          value={!!settings?.notifications?.pushEnabled}
          disabled={busy}
          onChange={async (v) => {
            await patchSettings({ pushNotificationsEnabled: v });
            if (v) {
              void registerPushNotificationsAsync();
            } else {
              void unregisterPushNotificationsAsync();
            }
          }}
        />
        <ToggleRow
          icon={Footprints}
          title="Nhắc bữa ăn"
          value={!!settings?.notifications?.mealReminders}
          disabled={busy}
          onChange={async (v) => {
            await patchSettings({ mealRemindersEnabled: v });
            if (v) {
              void syncCurrentMealReminders();
            } else {
              void cancelMealReminders();
            }
          }}
          last
        />
      </Card>
      {actionError ? (
        <Text style={{ color: CLR.danger, textAlign: 'center' }}>{actionError}</Text>
      ) : null}
      <Pressable
        style={{ paddingVertical: 12 }}
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
        <Text style={{ fontSize: 16, color: '#FF4D3D', textAlign: 'center' }}>Đăng xuất</Text>
      </Pressable>
    </LoadBlock>
  );
}

function EditPage() {
  const { updateDashboardCache, invalidateDashboard } = useProfileDashboard();
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSaveMsg(null);
    try {
      const [me, regionRes] = await Promise.all([
        profileApi.me<MeProfile>(),
        profileApi.getRegions(undefined, 50).catch(() => ({ items: [] as Array<{ id: string; name: string }> })),
      ]);
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
    const intent = await profileApi.createAvatarIntent<{
      mediaId: string;
      upload: SignedImageUpload;
    }>({
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
      setVersion((current) => current + 1);
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
      setVersion((current) => current + 1);
    }
  };

  const textFields: Array<{
    label: string;
    value: string;
    setValue: (v: string) => void;
    icon: ComponentType<any>;
    multiline?: boolean;
  }> = [
    { label: 'Họ và tên', value: displayName, setValue: setDisplayName, icon: UserRound },
    { label: 'Tên người dùng', value: username, setValue: setUsername, icon: Info },
    { label: 'Ngày sinh', value: dob, setValue: setDob, icon: CalendarDays },
    { label: 'Giới thiệu', value: bio, setValue: setBio, icon: Pencil, multiline: true },
  ];

  return (
    <LoadBlock loading={loading} error={error && !displayName ? error : null} onRetry={load} skeleton="edit">
      <View style={{ paddingVertical: 2 }}>
        <ImageUploadField
          value={avatarUri}
          variant="avatar"
          label="Ảnh đại diện"
          onUpload={uploadAvatar}
          onRemove={avatarUri ? removeAvatar : undefined}
          confirmRemove
        />
      </View>
      {textFields.map((f) => (
        <Card
          key={f.label}
          style={{
            minHeight: 54,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 16,
          }}
        >
          <SoftIcon icon={f.icon} compact />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 12, color: '#747474' }}>{f.label}</Text>
            {f.multiline ? (
              <Textarea
                value={f.value}
                onChangeText={f.setValue}
                editable={f.label !== 'Tên người dùng'}
                placeholder="—"
                placeholderTextColor="#A0A0A0"
                numberOfLines={2}
                className="mt-0.5 min-h-[28px] max-h-[52px] border-0 bg-transparent p-0 text-[15px] shadow-none"
              />
            ) : (
              <Input
                value={f.value}
                onChangeText={f.setValue}
                editable={f.label !== 'Tên người dùng'}
                placeholder="—"
                placeholderTextColor="#A0A0A0"
                className={cn(
                  'mt-0.5 h-7 border-0 bg-transparent p-0 text-[15px] shadow-none',
                  f.label === 'Tên người dùng' && 'text-muted-foreground',
                )}
              />
            )}
          </View>
        </Card>
      ))}
      <Card
        style={{
          minHeight: 54,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 16,
        }}
      >
        <SoftIcon icon={UserRound} compact />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 12, color: '#747474' }}>Giới tính</Text>
          <Select
            value={
              gender && gender !== '—'
                ? { value: gender, label: gender }
                : undefined
            }
            onValueChange={(opt) => {
              if (opt?.value) setGender(opt.value);
            }}
          >
            <SelectTrigger className="mt-0.5 h-7 border-0 bg-transparent p-0 shadow-none">
              <SelectValue placeholder="Chọn giới tính" className="text-[15px] font-medium" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {GENDER_OPTIONS.map((label) => (
                <SelectItem key={label} value={label} label={label}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </View>
      </Card>

      <Card
        style={{
          minHeight: 54,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 16,
        }}
      >
        <SoftIcon icon={MapPin} compact />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 12, color: '#747474' }}>Khu vực</Text>
          <Select
            value={
              regionId
                ? { value: regionId, label: regionName || 'Đã chọn' }
                : undefined
            }
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
            <SelectTrigger className="mt-0.5 h-7 border-0 bg-transparent p-0 shadow-none">
              <SelectValue placeholder="Chọn khu vực" className="text-[15px] font-medium" />
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
        </View>
      </Card>
      {error ? <Text style={{ color: CLR.danger, textAlign: 'center', fontSize: 13 }}>{error}</Text> : null}
      {saveMsg ? <Text style={{ color: '#2F9E44', textAlign: 'center', fontSize: 13 }}>{saveMsg}</Text> : null}
      <PrimaryButton text={saving ? 'Đang lưu…' : 'Lưu thay đổi'} onPress={save} disabled={saving} compact />
    </LoadBlock>
  );
}

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

  return (
    <LoadBlock loading={loading} error={error} onRetry={load} skeleton="journey">
      <Card
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 }}
      >
        <Sparkles size={60} color={CLR.yellowDark} fill={CLR.yellow} />
        <View>
          <Text style={{ fontSize: 30, fontWeight: '700', color: '#161616' }}>
            {streak}{' '}
            <Text style={{ fontSize: 19, fontWeight: '700', color: '#161616' }}>
              ngày liên tiếp
            </Text>
          </Text>
          <Text style={{ fontSize: 15, color: '#747474', marginTop: 3 }}>
            Kỷ lục dài nhất: {longest} ngày
          </Text>
        </View>
      </Card>
      <MonthCalendar month={data?.month ?? month} days={days} />
      <Text style={{ fontSize: 20, fontWeight: '700', color: '#161616', marginVertical: 4 }}>
        Thành tích
      </Text>
      {achievements.length === 0 ? (
        <Card>
          <Text style={{ color: '#747474', textAlign: 'center' }}>Chưa có thành tích.</Text>
        </Card>
      ) : (
        <Card style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {achievements.slice(0, 3).map((a) => (
            <View key={a.id ?? a.code} style={{ flex: 1, minWidth: '30%', alignItems: 'center', gap: 7, paddingVertical: 4 }}>
              <Sparkles color={CLR.yellowDark} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#161616', textAlign: 'center' }}>
                {a.name}
              </Text>
              <Text style={{ fontSize: 14, color: '#747474', marginTop: 2, textAlign: 'center' }}>
                {a.progress ?? 0}/{a.target ?? '—'}
              </Text>
            </View>
          ))}
        </Card>
      )}
      <Text style={{ fontSize: 20, fontWeight: '700', color: '#161616', marginVertical: 4 }}>
        Tiến độ tháng này
      </Text>
      <Card>
        {monthlyGoals.length === 0 ? (
          <Text style={{ color: '#747474' }}>Chưa có mục tiêu tháng.</Text>
        ) : (
          monthlyGoals.map((g) => {
            const current = Number(g.current ?? 0);
            const target = Math.max(Number(g.target ?? 1), 1);
            const pct = Math.min(100, Math.round((current / target) * 100));
            return (
              <View key={g.code ?? g.label} style={{ paddingVertical: 12, gap: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#161616' }}>
                  {g.label}  {current}/{target}
                </Text>
                <View
                  style={{
                    height: 9,
                    borderRadius: 5,
                    backgroundColor: '#F1EEE7',
                    overflow: 'hidden',
                    marginTop: 10,
                  }}
                >
                  <View
                    style={{
                      height: '100%',
                      borderRadius: 5,
                      backgroundColor: '#FFD54F',
                      width: `${pct}%`,
                    }}
                  />
                </View>
              </View>
            );
          })
        )}
      </Card>
    </LoadBlock>
  );
}

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
      const [hp, me] = await Promise.all([
        profileApi.getHealthProfile<any>(),
        profileApi.me<MeProfile>(),
      ]);
      setData(hp);
      setVersion(me.version ?? me.profileVersion ?? 1);
      setHeight(
        hp?.latestMeasurements?.height?.value != null
          ? String(hp.latestMeasurements.height.value)
          : '',
      );
      setWeight(
        hp?.latestMeasurements?.weight?.value != null
          ? String(hp.latestMeasurements.weight.value)
          : '',
      );
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
      if (h != null && Number.isFinite(h)) {
        await healthApi.createMeasurement({ type: 'HEIGHT_CM', value: h, unit: 'cm' });
      }
      if (w != null && Number.isFinite(w)) {
        await healthApi.createMeasurement({ type: 'WEIGHT_KG', value: w, unit: 'kg' });
      }
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

  const bmi =
    data?.bmi?.status === 'AVAILABLE' && data?.bmi?.value != null
      ? Number(data.bmi.value).toFixed(1).replace('.', ',')
      : '—';
  const targetWeight =
    data?.targetWeight?.value != null ? `${data.targetWeight.value} kg` : '—';
  const activity = activityLabel(data?.activityLevel);
  const targets = data?.dailyTargets;

  return (
    <LoadBlock loading={loading} error={error && !data ? error : null} onRetry={load} skeleton="form">
      <Card
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 15,
          borderWidth: 1,
          borderColor: '#F5D788',
        }}
      >
        <ShieldCheck size={52} color={CLR.yellowDark} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#161616' }}>
            Dữ liệu giúp Mogu gợi ý món phù hợp hơn
          </Text>
          <Text style={{ fontSize: 14, color: '#747474', marginTop: 2 }}>
            Mogu cam kết bảo mật thông tin cá nhân của bạn tuyệt đối.
          </Text>
        </View>
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {[
          ['Chiều cao', height, setHeight, 'cm'],
          ['Cân nặng', weight, setWeight, 'kg'],
        ].map(([a, v, setV, unit]) => (
          <Card key={a as string} style={{ width: '48%', minHeight: 130, justifyContent: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#161616' }}>{a as string}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
              <Input
                value={v as string}
                onChangeText={setV as (t: string) => void}
                keyboardType="decimal-pad"
                placeholder="—"
                placeholderTextColor="#A0A0A0"
                className="h-auto flex-1 border-0 bg-transparent p-0 text-[30px] font-bold shadow-none"
              />
              <Text style={{ fontSize: 14, color: '#747474', marginBottom: 6 }}>{unit as string}</Text>
            </View>
          </Card>
        ))}
        <Card style={{ width: '48%', minHeight: 130, justifyContent: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#161616' }}>BMI</Text>
          <Text style={{ fontSize: 30, fontWeight: '700', color: '#161616' }}>{bmi}</Text>
        </Card>
        <Card style={{ width: '48%', minHeight: 130, justifyContent: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#161616' }}>Mục tiêu cân nặng</Text>
          <Text style={{ fontSize: 30, fontWeight: '700', color: '#161616' }}>{targetWeight}</Text>
        </Card>
      </View>
      <Card>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#161616', marginVertical: 4 }}>
          Mức độ vận động
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          {['Ít vận động', 'Vừa phải', 'Năng động'].map((t) => (
            <Chip key={t} text={t} active={activity === t} />
          ))}
        </View>
      </Card>
      <Card>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#161616', marginVertical: 4 }}>
          Mục tiêu mỗi ngày
        </Text>
        <View style={{ flexDirection: 'row', marginTop: 15 }}>
          {[
            ['Năng lượng', targets?.energyKcal != null ? `${targets.energyKcal} kcal` : '—'],
            ['Protein', targets?.proteinG != null ? `${targets.proteinG} g` : '—'],
            [
              'Nước',
              targets?.waterMl != null
                ? `${(targets.waterMl / 1000).toLocaleString('vi-VN')} L`
                : '—',
            ],
            [
              'Bước',
              targets?.steps != null ? Number(targets.steps).toLocaleString('vi-VN') : '—',
            ],
          ].map(([a, b]) => (
            <View key={a} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, color: '#747474', marginTop: 2 }}>{a}</Text>
              <Text style={{ fontSize: 19, fontWeight: '700', color: '#161616' }}>{b}</Text>
            </View>
          ))}
        </View>
      </Card>
      {error ? <Text style={{ color: CLR.danger, textAlign: 'center' }}>{error}</Text> : null}
      {msg ? <Text style={{ color: '#2F9E44', textAlign: 'center' }}>{msg}</Text> : null}
      <PrimaryButton
        text={saving ? 'Đang cập nhật…' : 'Cập nhật thông tin'}
        onPress={save}
        disabled={saving}
      />
    </LoadBlock>
  );
}

function PreferencesPage() {
  const { invalidateDashboard } = useProfileDashboard();
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
      const [me, catalog] = await Promise.all([
        profileApi.me<MeProfile>(),
        onboardingApi.catalog(),
      ]);
      setVersion(me.version ?? me.profileVersion ?? 1);
      setGoals(catalog.goals ?? []);
      setTastes(catalog.dietaryPreferences?.taste ?? []);
      setDiets(catalog.dietaryPreferences?.diet ?? []);
      setGoalId(me.preferences?.primaryGoal?.id ?? null);
      setTasteIds((me.preferences?.tastePreferences ?? []).map((x) => x.id));
      setDietIds((me.preferences?.dietTypes ?? []).map((x) => x.id));
      const pri: Record<string, boolean> = {
        HEALTHY: false,
        ECONOMY: false,
        QUICK: false,
        NOVELTY: false,
      };
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
        {
          primaryGoalId: goalId ?? undefined,
          dietaryPreferenceIds: [...tasteIds, ...dietIds],
        },
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

  return (
    <LoadBlock loading={loading} error={error && goals.length === 0 ? error : null} onRetry={load} skeleton="form">
      <IdChoiceCard
        title="Mục tiêu chính"
        items={goals}
        value={goalId}
        setValue={setGoalId}
      />
      <IdChoiceCard
        title="Khẩu vị yêu thích"
        items={tastes}
        multi
        values={tasteIds}
        toggle={(id) => toggleId(tasteIds, id, setTasteIds)}
      />
      <IdChoiceCard
        title="Ẩm thực yêu thích"
        items={diets}
        multi
        values={dietIds}
        toggle={(id) => toggleId(dietIds, id, setDietIds)}
      />
      <Card>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#161616', marginVertical: 4 }}>
          Ưu tiên khi chọn món
        </Text>
        <Text style={{ fontSize: 13, color: '#747474', marginBottom: 8 }}>
          Đang xem trạng thái hiện tại. Lưu ưu tiên chưa có trên API — thay đổi tại đây sẽ không
          được gửi khi bấm Lưu.
        </Text>
        <ToggleRow
          icon={HeartPulse}
          title="Lành mạnh"
          value={priorities.HEALTHY}
          disabled
          onChange={() => undefined}
        />
        <ToggleRow
          icon={Bookmark}
          title="Tiết kiệm"
          value={priorities.ECONOMY}
          disabled
          onChange={() => undefined}
        />
        <ToggleRow
          icon={History}
          title="Nhanh gọn"
          value={priorities.QUICK}
          disabled
          onChange={() => undefined}
        />
        <ToggleRow
          icon={Sparkles}
          title="Thử món mới"
          value={priorities.NOVELTY}
          disabled
          onChange={() => undefined}
          last
        />
      </Card>
      {error ? <Text style={{ color: CLR.danger, textAlign: 'center' }}>{error}</Text> : null}
      {msg ? <Text style={{ color: '#2F9E44', textAlign: 'center' }}>{msg}</Text> : null}
      <PrimaryButton text={saving ? 'Đang lưu…' : 'Lưu thay đổi'} onPress={save} disabled={saving} />
    </LoadBlock>
  );
}

type AvoidItem = {
  name: string;
  ingredientId?: string | null;
  mode?: 'HARD' | 'SOFT';
};

function AvoidPage() {
  const queryClient = useQueryClient();
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

        const extraStaples = [
          { name: 'Nấm' },
          { name: 'Thịt bò' },
          { name: 'Thịt heo' },
        ];

        const combined: Array<{ name: string; id?: string }> = [...topAllergens];
        for (const extra of extraStaples) {
          if (!combined.some((c) => c.name.toLowerCase() === extra.name.toLowerCase())) {
            combined.push(extra);
          }
        }
        setSuggestions(combined.slice(0, 6));
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

  // Live debounced search against BE ingredients dictionary
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
        if (!cancelled) {
          setSearchResults(Array.isArray(results) ? results : []);
        }
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

  const addTag = (name: string, ingredientId?: string | null) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    if (tags.some((x) => x.name.toLowerCase() === cleanName.toLowerCase())) return;
    setTags((prev) => [...prev, { name: cleanName, ingredientId: ingredientId ?? null, mode: 'HARD' }]);
    setQuery('');
    setSearchResults([]);
  };

  const removeTag = (name: string) => {
    setTags((prev) => prev.filter((t) => t.name.toLowerCase() !== name.toLowerCase()));
  };

  const toggleTag = (name: string, ingredientId?: string | null) => {
    const cleanName = name.trim();
    if (tags.some((x) => x.name.toLowerCase() === cleanName.toLowerCase())) {
      removeTag(cleanName);
    } else {
      addTag(cleanName, ingredientId);
    }
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      await profileApi.putAvoidances({
        items: tags.map((t) => ({
          text: t.name,
          ingredientId: t.ingredientId ?? undefined,
          mode: t.mode ?? 'HARD',
        })),
      });
      setMsg('Đã lưu lựa chọn thành công.');
      recordAvoidancesUpdatedStore();
      Alert.alert('Thành công', 'Đã lưu danh sách nguyên liệu cần tránh.');
    } catch (e) {
      setError(errMsg(e, 'Không lưu được.'));
      Alert.alert('Lỗi', errMsg(e, 'Không lưu được danh sách nguyên liệu.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <LoadBlock loading={loading} error={error && tags.length === 0 ? error : null} onRetry={load} skeleton="form">
      <Card
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 15,
          borderWidth: 1,
          borderColor: '#F5D788',
        }}
      >
        <Info color={CLR.yellowDark} />
        <Text style={{ fontSize: 16, lineHeight: 24, color: '#161616', flex: 1 }}>
          Mogu sẽ loại các món có chứa nguyên liệu bạn chọn.
        </Text>
      </Card>
      <View
        style={{
          height: 58,
          borderRadius: 18,
          backgroundColor: '#fff',
          borderWidth: 1,
          borderColor: '#E8E4DC',
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Search color={CLR.secondary} size={20} />
        <Input
          placeholder="Tìm nguyên liệu..."
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => addTag(query)}
          className="h-auto flex-1 border-0 bg-transparent p-0 text-[15px] shadow-none"
        />
        {isSearching ? (
          <ActivityIndicator size="small" color={CLR.yellowDark} />
        ) : query.trim() ? (
          <Pressable onPress={() => addTag(query)} hitSlop={8} accessibilityLabel="Thêm nguyên liệu">
            <Plus color={CLR.yellowDark} size={22} />
          </Pressable>
        ) : null}
      </View>

      {/* Live autocomplete search results from BE ingredients API */}
      {searchResults.length > 0 && (
        <Card
          style={{
            marginTop: -6,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: '#E8E4DC',
            backgroundColor: '#fff',
            padding: 8,
            maxHeight: 240,
          }}
        >
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {searchResults.map((item, idx) => {
              const isSelected = tags.some((t) => t.name.toLowerCase() === item.name.toLowerCase());
              return (
                <Pressable
                  key={item.id || idx}
                  onPress={() => toggleTag(item.name, item.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderBottomWidth: idx < searchResults.length - 1 ? 1 : 0,
                    borderBottomColor: '#F3F0E6',
                  }}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#161616' }}>
                      {item.name}
                    </Text>
                    {item.allergenCode ? (
                      <Text style={{ fontSize: 12, color: '#854D0E', marginTop: 2 }}>
                        Nhóm: {item.allergenCode}
                      </Text>
                    ) : null}
                  </View>
                  {isSelected ? (
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: '#FEF3C7',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Check size={16} color="#D97706" />
                    </View>
                  ) : (
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: '#FFFBEB',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Plus size={16} color={CLR.yellowDark} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </Card>
      )}

      <Text style={{ fontSize: 20, fontWeight: '700', color: '#161616', marginVertical: 4 }}>
        Đã chọn
      </Text>
      {tags.length === 0 ? (
        <Text style={{ color: '#747474' }}>Chưa chọn nguyên liệu nào.</Text>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {tags.map((x) => (
            <Pressable
              key={x.name}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#F4D99C',
                backgroundColor: '#FFFBEB',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
              onPress={() => removeTag(x.name)}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#854D0E' }}>
                {x.name}
              </Text>
              <X size={14} color="#854D0E" />
            </Pressable>
          ))}
        </View>
      )}

      <Text style={{ fontSize: 20, fontWeight: '700', color: '#161616', marginVertical: 4 }}>
        Gợi ý phổ biến
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {suggestions.map((x) => {
          const isSelected = tags.some((t) => t.name.toLowerCase() === x.name.toLowerCase());
          return (
            <Pressable
              key={x.name}
              style={{
                width: '48%',
                height: 70,
                borderRadius: 18,
                backgroundColor: isSelected ? '#FFFBEB' : '#fff',
                borderWidth: isSelected ? 1.5 : 0,
                borderColor: isSelected ? '#F5BD18' : 'transparent',
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                shadowColor: '#5D490F',
                shadowOpacity: isSelected ? 0.04 : 0.08,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 6 },
                elevation: 3,
              }}
              onPress={() => toggleTag(x.name, x.id)}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: isSelected ? '#854D0E' : '#161616' }}>
                {x.name}
              </Text>
              {isSelected ? (
                <Check size={20} color="#D97706" />
              ) : (
                <Plus size={20} color={CLR.yellowDark} />
              )}
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={{ color: CLR.danger, textAlign: 'center' }}>{error}</Text> : null}
      {msg ? <Text style={{ color: '#2F9E44', textAlign: 'center' }}>{msg}</Text> : null}
      <PrimaryButton
        text={saving ? 'Đang lưu…' : `Lưu ${tags.length} lựa chọn`}
        onPress={save}
        disabled={saving}
      />
    </LoadBlock>
  );
}

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
  const load = useCallback((q?: string) => {
    if (q !== undefined) setQApplied(q);
    void refetch();
  }, [refetch]);

  return (
    <>
      <View
        style={{
          height: 58,
          borderRadius: 18,
          backgroundColor: '#fff',
          borderWidth: 1,
          borderColor: '#E8E4DC',
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Search />
        <Input
          placeholder="Tìm trong món đã lưu..."
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => {
            setQApplied(query.trim());
            load(query.trim());
          }}
          className="h-auto flex-1 border-0 bg-transparent p-0 text-[15px] shadow-none"
        />
      </View>
      <LoadBlock
        loading={loading}
        error={error}
        onRetry={() => load(qApplied)}
        empty={!loading && !error && items.length === 0}
        emptyText="Chưa có món đã lưu."
        skeleton="saved"
      >
        <Text style={{ fontSize: 15, color: '#747474', marginTop: 3 }}>
          {items.length} món đã lưu
        </Text>
        {items.map((row) => {
          const dish = row.dish ?? (row as any);
          const dishId = dish?.id ?? row.dishId;
          const kcal = dish.kcal ?? dish.nutrition?.calories ?? dish.calories;
          const minutes = dish.cookTimeMinutes ?? dish.prepMinutes ?? dish.cookMinutes;
          const price = formatPriceRange(dish.priceMin, dish.priceMax);
          const meta = [kcal != null ? `${kcal} kcal` : null, minutes != null ? `${minutes} phút` : null, price]
            .filter(Boolean)
            .join(' · ');
          return (
            <FoodRow
              key={row.id ?? dish.id}
              image={dishImageSource(dish.thumbnailUrl ?? (dish as any).imageUrl, dish.media)}
              name={dish.name ?? 'Món ăn'}
              meta={meta || '—'}
              onPress={dishId ? () => onOpenDish?.(dishId, dish?.name) : undefined}
            />
          );
        })}
      </LoadBlock>
    </>
  );
}

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

  return (
    <LoadBlock loading={loading} error={error} onRetry={load} skeleton="form">
      <Card>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#161616', marginVertical: 4 }}>
          Bảo mật tài khoản
        </Text>
        <Row
          icon={LockKeyhole}
          title="Đổi mật khẩu"
          onPress={() => setShowPwd(!showPwd)}
        />
        {showPwd ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}>
            <Input
              placeholder="Mật khẩu hiện tại"
              secureTextEntry
              value={pwdCurrent}
              onChangeText={setPwdCurrent}
              className="h-11 rounded-xl"
            />
            <Input
              placeholder="Mật khẩu mới"
              secureTextEntry
              value={pwdNew}
              onChangeText={setPwdNew}
              className="h-11 rounded-xl"
            />
            <PrimaryButton
              text={busy ? 'Đang đổi…' : 'Xác nhận đổi mật khẩu'}
              disabled={busy || !pwdCurrent || !pwdNew}
              onPress={() =>
                runAction(
                  () => authApi.changePassword(pwdCurrent, pwdNew),
                  'Đã đổi mật khẩu.',
                )
              }
            />
          </View>
        ) : null}
        <Row
          icon={LockKeyhole}
          title={`Thiết bị đã đăng nhập (${sessions.length})`}
          last
          onPress={() =>
            confirmAction(
              'Đăng xuất thiết bị khác?',
              'Các phiên đăng nhập khác sẽ bị hủy. Phiên hiện tại vẫn giữ.',
              () =>
                void runAction(
                  () => authApi.deleteAllSessionsExceptCurrent(),
                  'Đã đăng xuất các thiết bị khác.',
                ),
              'Đăng xuất hết',
            )
          }
        />
      </Card>
      <Card>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#161616', marginVertical: 4 }}>
          Quyền riêng tư
        </Text>
        <ToggleRow
          icon={LockKeyhole}
          title="Hồ sơ công khai"
          value={(settings?.privacy?.profileVisibility ?? 'PUBLIC') === 'PUBLIC'}
          disabled={busy}
          onChange={(v) => patch({ profileVisibility: v ? 'PUBLIC' : 'PRIVATE' })}
        />
        <ToggleRow
          icon={LockKeyhole}
          title="Hiển thị hoạt động ăn uống"
          value={!!settings?.privacy?.showDietActivity}
          disabled={busy}
          onChange={(v) => patch({ showDietActivity: v })}
        />
        <ToggleRow
          icon={LockKeyhole}
          title="Cho phép bình luận"
          value={settings?.privacy?.allowComments !== false}
          disabled={busy}
          onChange={(v) => patch({ allowComments: v })}
          last
        />
      </Card>
      <Card>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#161616', marginVertical: 4 }}>
          Dữ liệu của bạn
        </Text>
        <Row
          icon={LockKeyhole}
          title="Tải dữ liệu của tôi"
          onPress={() =>
            runAction(() => profileApi.requestDataExport(), 'Đã tạo yêu cầu xuất dữ liệu.')
          }
        />
        <Row
          icon={LockKeyhole}
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
        <Row
          icon={LockKeyhole}
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
      </Card>
      {actionError ? (
        <Text style={{ color: CLR.danger, textAlign: 'center' }}>{actionError}</Text>
      ) : null}
      {msg ? <Text style={{ color: '#2F9E44', textAlign: 'center' }}>{msg}</Text> : null}
      <Pressable
        style={{
          height: 58,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: '#FF4D3D',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          opacity: busy ? 0.6 : 1,
        }}
        disabled={busy}
        onPress={() =>
          confirmAction(
            'Xóa tài khoản?',
            'Yêu cầu xóa tài khoản sẽ được gửi. Hành động này có thể không hoàn tác.',
            () =>
              void runAction(
                () => profileApi.requestAccountDeletion(),
                'Đã gửi yêu cầu xóa tài khoản.',
              ),
            'Gửi yêu cầu',
          )
        }
      >
        <Trash2 color={CLR.danger} />
        <Text style={{ color: '#FF4D3D', fontWeight: '600' }}>Xóa tài khoản</Text>
      </Pressable>
    </LoadBlock>
  );
}

function HistoryPage({ onOpenDish }: { onOpenDish?: (dishId: string, title?: string) => void }) {
  const { data, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ['profile', 'randomHistory'],
    queryFn: async () => {
      const [sum, hist] = await Promise.all([
        dishesApi.getRandomHistorySummary(),
        dishesApi.getRandomHistory(30),
      ]);
      return {
        summary: sum,
        items: (hist.data ?? (hist as any).items ?? []) as any[],
      };
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
  const load = useCallback(() => void refetch(), [refetch]);

  const total = summary?.totalRuns ?? 0;
  const selected = summary?.selectedCount ?? 0;
  const skipped = summary?.skippedCount ?? Math.max(total - selected, 0);
  const rate = total > 0 ? Math.round((selected / total) * 100) : 0;

  return (
    <LoadBlock
      loading={loading}
      error={error}
      onRetry={load}
      empty={!loading && !error && items.length === 0 && total === 0}
      emptyText="Chưa có lần Random nào."
      skeleton="history"
    >
      <Card style={{ alignItems: 'center' }}>
        <Sparkles color={CLR.yellowDark} />
        <Text style={{ fontSize: 30, fontWeight: '700', color: '#161616' }}>{total}</Text>
        <Text style={{ fontSize: 15, color: '#747474', marginTop: 3 }}>lần Random</Text>
        <View
          style={{
            flexDirection: 'row',
            marginTop: 18,
            paddingTop: 14,
            borderTopWidth: 1,
            borderTopColor: '#E8E4DC',
          }}
        >
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 19, fontWeight: '700', color: '#161616' }}>{selected}</Text>
            <Text style={{ fontSize: 13, color: '#747474', marginTop: 3, textAlign: 'center' }}>
              món đã chọn
            </Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 19, fontWeight: '700', color: '#161616' }}>{skipped}</Text>
            <Text style={{ fontSize: 13, color: '#747474', marginTop: 3, textAlign: 'center' }}>
              Random lại
            </Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 19, fontWeight: '700', color: '#161616' }}>{rate}%</Text>
            <Text style={{ fontSize: 13, color: '#747474', marginTop: 3, textAlign: 'center' }}>
              tỷ lệ chọn
            </Text>
          </View>
        </View>
      </Card>
      {items.length === 0 ? (
        <Text style={{ color: '#747474', textAlign: 'center' }}>Chưa có lịch sử chi tiết.</Text>
      ) : (
        items.map((row) => {
          const dish = row.dish;
          const dishId = dish?.id ?? row.dishId;
          const time = formatRelTime(row.createdAt);
          const isSelected = row.isSelected || row.outcome === 'SELECTED';
          const outcome = isSelected ? 'Đã chọn' : 'Random lại';
          return (
            <FoodRow
              key={row.id}
              image={dishImageSource(dish?.imageUrl, dish?.media)}
              name={dish?.name ?? 'Món không còn khả dụng'}
              meta={time}
              badge={{
                text: outcome,
                variant: isSelected ? 'success' : 'muted',
              }}
              onPress={dishId ? () => onOpenDish?.(dishId, dish?.name) : undefined}
            />
          );
        })
      )}
    </LoadBlock>
  );
}

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
      return {
        pubItems: (pub.data ?? []) as ExplorePost[],
        draftItems: (draft.data ?? []) as ExplorePost[],
      };
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  useEffect(() => {
    void refetch();
  }, [refetch, appliedQuery]);

  const pubItems = data?.pubItems ?? [];
  const draftItems = data?.draftItems ?? [];
  const counts = { active: pubItems.length, draft: draftItems.length };
  const posts = tab === 'ACTIVE' ? pubItems : draftItems;
  const loading = isLoading && !data;
  const error = queryError ? errMsg(queryError, 'Không tải được bài viết.') : null;
  const load = (_status: 'ACTIVE' | 'DRAFT', q?: string) => {
    if (q !== undefined) setAppliedQuery(q);
    void refetch();
  };

  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Chip
          text={`Đã đăng ${counts.active}`}
          active={tab === 'ACTIVE'}
          onPress={() => setTab('ACTIVE')}
        />
        <Chip
          text={`Bản nháp ${counts.draft}`}
          active={tab === 'DRAFT'}
          onPress={() => setTab('DRAFT')}
        />
      </View>
      <View
        style={{
          height: 58,
          borderRadius: 18,
          backgroundColor: '#fff',
          borderWidth: 1,
          borderColor: '#E8E4DC',
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Search />
        <Input
          placeholder="Tìm bài viết..."
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => load(tab, query.trim() || undefined)}
          className="h-auto flex-1 border-0 bg-transparent p-0 text-[15px] shadow-none"
        />
      </View>
      <LoadBlock
        loading={loading}
        error={error}
        onRetry={() => load(tab, query.trim() || undefined)}
        empty={!loading && !error && posts.length === 0}
        emptyText="Chưa có bài viết."
        skeleton="list"
      >
        {posts.map((p) => {
          const avatarUri = p.author?.avatarUrl;
          const img = p.imageUrls?.[0];
          return (
            <Card key={p.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <AvatarImage uri={avatarUri} size={44} />
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#161616' }}>
                    {p.author?.displayName ?? 'Bạn'}
                  </Text>
                  <Text style={{ fontSize: 14, color: '#747474', marginTop: 2 }}>
                    {formatRelTime(p.createdAt)}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 18, fontWeight: '600', marginVertical: 14 }}>
                {p.content}
              </Text>
              {img ? (
                <Image
                  source={{ uri: img }}
                  style={{ width: '100%', height: 210, borderRadius: 16 }}
                />
              ) : null}
              <Text style={{ fontSize: 15, color: '#747474', marginTop: 3 }}>
                ♡ {p.likeCount ?? 0} lượt thích · ◯ {p.commentCount ?? 0} bình luận
              </Text>
            </Card>
          );
        })}
      </LoadBlock>
    </>
  );
}








function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View className="h-[60px] px-4 flex-row items-center justify-between bg-[#FFF9E8]">
      <IconButton icon={ArrowLeft} onPress={onBack} />
      <Text className="text-[22px] font-bold text-[#161616]">{title}</Text>
      <View className="w-11" />
    </View>
  );
}
function Card({ children, style, noPadding }: { children: any; style?: any; noPadding?: boolean }) {
  return (
    <View
      style={[
        {
          backgroundColor: '#fff',
          borderRadius: 22,
          padding: noPadding ? 0 : 16,
          shadowColor: '#5D490F',
          shadowOpacity: 0.08,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 6 },
          elevation: 3,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
function IconButton({ icon: Icon, onPress }: { icon: ComponentType<any>; onPress?: () => void }) {
  return (
    <Pressable className="w-11 h-11 items-center justify-center" onPress={onPress}>
      <Icon size={27} color="#161616" />
    </Pressable>
  );
}
function SoftIcon({ icon: Icon, compact }: { icon: ComponentType<any>; compact?: boolean }) {
  if (compact) {
    return (
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: '#FFF7DF',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={18} color="#805B0A" />
      </View>
    );
  }
  return (
    <View className="w-11 h-11 rounded-[13px] bg-[#FFF7DF] items-center justify-center">
      <Icon size={24} color="#805B0A" />
    </View>
  );
}

function Row({
  icon,
  title,
  sub,
  onPress,
  last,
}: {
  icon: ComponentType<any>;
  title: string;
  sub?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      style={{
        minHeight: 70,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: '#E8E4DC',
        paddingHorizontal: 16,
      }}
      onPress={onPress}
    >
      <SoftIcon icon={icon} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#161616' }}>{title}</Text>
        {sub && <Text style={{ fontSize: 14, color: '#747474', marginTop: 2 }}>{sub}</Text>}
      </View>
      <ChevronRight size={21} />
    </Pressable>
  );
}
function ToggleRow({
  icon,
  title,
  initial,
  value,
  onChange,
  disabled,
  last,
}: {
  icon: ComponentType<any>;
  title: string;
  initial?: boolean;
  value?: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  last?: boolean;
}) {
  const [on, setOn] = useState(!!initial);
  const checked = value !== undefined ? value : on;
  return (
    <View
      style={{
        minHeight: 70,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: '#E8E4DC',
        paddingHorizontal: 16,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <SoftIcon icon={icon} />
      <Text style={{ fontSize: 16, fontWeight: '600', color: '#161616', flex: 1 }}>{title}</Text>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => {
          if (value === undefined) setOn(next);
          onChange?.(next);
        }}
      />
    </View>
  );
}
function Shortcut({
  icon,
  title,
  sub,
  onPress,
}: {
  icon: ComponentType<any>;
  title: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={{
        width: '48%',
        minHeight: 74,
        backgroundColor: '#fff',
        borderRadius: 18,
        paddingHorizontal: 10,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        shadowColor: '#5D490F',
        shadowOpacity: 0.08,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 6 },
        elevation: 3,
      }}
      onPress={onPress}
    >
      <SoftIcon icon={icon} compact />
      <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
        <Text
          style={{ fontSize: 13.5, fontWeight: '700', color: '#161616' }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {title}
        </Text>
        <Text style={{ fontSize: 12, color: '#747474', marginTop: 2 }} numberOfLines={1}>
          {sub}
        </Text>
      </View>
    </Pressable>
  );
}
function PrimaryButton({
  text,
  onPress,
  disabled,
  compact,
}: {
  text: string;
  onPress?: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={{
        height: compact ? 48 : 56,
        borderRadius: compact ? 14 : 16,
        backgroundColor: '#FFD54F',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#5D490F',
        shadowOpacity: compact ? 0.05 : 0.08,
        shadowRadius: compact ? 12 : 20,
        shadowOffset: { width: 0, height: compact ? 3 : 6 },
        elevation: compact ? 2 : 3,
        opacity: disabled ? 0.6 : 1,
        marginTop: compact ? 4 : 0,
      }}
    >
      <Text className={compact ? 'text-[16px] font-bold text-[#161616]' : 'text-[17px] font-bold text-[#161616]'}>
        {text}
      </Text>
    </Pressable>
  );
}
function Chip({
  text,
  active,
  onPress,
}: {
  text: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        minHeight: 40,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: active ? '#F5B900' : '#E8E4DC',
        backgroundColor: active ? '#FFD54F' : '#fff',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 14, color: '#161616', fontWeight: active ? '700' : '400' }}>
        {text}
      </Text>
    </Pressable>
  );
}
function IdChoiceCard({
  title,
  items,
  value,
  setValue,
  multi,
  values,
  toggle,
}: {
  title: string;
  items: CatalogItem[];
  value?: string | null;
  setValue?: (x: string) => void;
  multi?: boolean;
  values?: string[];
  toggle?: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <Card>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#161616', marginVertical: 4 }}>
          {title}
        </Text>
        <Text style={{ color: '#747474', marginTop: 8 }}>Chưa có lựa chọn từ catalog.</Text>
      </Card>
    );
  }
  return (
    <Card>
      <Text style={{ fontSize: 20, fontWeight: '700', color: '#161616', marginVertical: 4 }}>
        {title}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
        {items.map((x) => {
          const active = multi ? (values ?? []).includes(x.id) : value === x.id;
          return (
            <Pressable
              key={x.id}
              style={{
                width: '31.3%',
                minHeight: 60,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: active ? '#F5B900' : '#E8E4DC',
                backgroundColor: active ? '#FFF4C7' : '#fff',
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 6,
                paddingVertical: 8,
              }}
              onPress={() => (multi ? toggle?.(x.id) : setValue?.(x.id))}
            >
              <Text
                style={{
                  fontSize: 13.5,
                  fontWeight: active ? '700' : '600',
                  color: '#161616',
                  textAlign: 'center',
                }}
              >
                {x.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}
function FoodRow({
  image,
  name,
  meta,
  badge,
  onPress,
  isSaved,
  onBookmarkPress,
  rightAction,
}: {
  image: ImageSourcePropType;
  name: string;
  meta?: string;
  badge?: {
    text: string;
    variant?: 'success' | 'muted' | 'warning';
  };
  onPress?: () => void;
  isSaved?: boolean;
  onBookmarkPress?: () => void;
  rightAction?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`Xem chi tiết món ${name}`}
      className="bg-white rounded-[22px] p-2.5 flex-row items-center gap-3.5 active:opacity-90"
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 22,
        padding: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        shadowColor: '#5D490F',
        shadowOpacity: 0.08,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 6 },
        elevation: 3,
      }}
    >
      <Image
        source={image}
        className="w-[100px] h-[92px] rounded-[16px] bg-[#F5EEDB]"
        style={{ width: 100, height: 92, borderRadius: 16, backgroundColor: '#F5EEDB' }}
        resizeMode="cover"
      />
      <View
        className="flex-1 justify-center min-w-0"
        style={{ flex: 1, justifyContent: 'center' }}
      >
        <Text
          numberOfLines={2}
          className="text-[17px] font-bold text-[#161616] mb-1"
          style={{ fontSize: 17, fontWeight: '700', color: '#161616', marginBottom: 4 }}
        >
          {name}
        </Text>
        <View
          className="flex-row items-center flex-wrap gap-1.5"
          style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}
        >
          {badge && (
            <View
              className={`px-2 py-0.5 rounded-full flex-row items-center gap-1 ${
                badge.variant === 'success'
                  ? 'bg-[#E8F5E9]'
                  : badge.variant === 'warning'
                  ? 'bg-[#FFF8E1]'
                  : 'bg-[#F0EBE1]'
              }`}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor:
                  badge.variant === 'success'
                    ? '#E8F5E9'
                    : badge.variant === 'warning'
                    ? '#FFF8E1'
                    : '#F0EBE1',
              }}
            >
              {badge.variant === 'success' && <Check size={11} color="#2E7D32" strokeWidth={2.5} />}
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color:
                    badge.variant === 'success'
                      ? '#2E7D32'
                      : badge.variant === 'warning'
                      ? '#B78103'
                      : '#747474',
                }}
              >
                {badge.text}
              </Text>
            </View>
          )}
          {meta ? (
            <Text
              numberOfLines={1}
              className="text-[13px] text-[#747474]"
              style={{ fontSize: 13, color: '#747474' }}
            >
              {meta}
            </Text>
          ) : null}
        </View>
      </View>

      {rightAction ? (
        <View style={{ paddingRight: 4 }}>{rightAction}</View>
      ) : onBookmarkPress || isSaved !== undefined ? (
        <Pressable
          hitSlop={12}
          onPress={
            onBookmarkPress
              ? (e) => {
                  e.stopPropagation();
                  onBookmarkPress();
                }
              : undefined
          }
          style={({ pressed }) => ({
            padding: 6,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Bookmark color="#F5BD18" fill={isSaved ? '#FFD54F' : 'transparent'} size={20} />
        </Pressable>
      ) : onPress ? (
        <View style={{ paddingRight: 4 }}>
          <ChevronRight size={18} color="#C4BDB0" />
        </View>
      ) : null}
    </Pressable>
  );
}
function MonthCalendar({
  month,
  days,
}: {
  month: string;
  days: Array<{ localDate: string; status: string }>;
}) {
  const [y, m] = month.split('-').map(Number);
  const label = Number.isFinite(y) && Number.isFinite(m)
    ? `Tháng ${m}, ${y}`
    : month;
  const dayMap = new Map(days.map((d) => [d.localDate, d.status]));
  const daysInMonth =
    Number.isFinite(y) && Number.isFinite(m) ? new Date(y, m, 0).getDate() : 31;

  return (
    <Card>
      <Text style={{ fontSize: 19, fontWeight: '700', color: '#161616' }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
          const iso = `${month}-${String(d).padStart(2, '0')}`;
          const status = dayMap.get(iso) ?? 'EMPTY';
          const done = status === 'QUALIFIED' || status === 'COMPLETED' || status === 'IN_PROGRESS';
          return (
            <View
              key={d}
              style={{
                width: '11.5%',
                aspectRatio: 1,
                borderRadius: 22,
                backgroundColor: done ? '#FFD54F' : '#FFF8E6',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 12 }}>{d}</Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}
