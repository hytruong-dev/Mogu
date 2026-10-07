import { useState } from 'react';
import { Text, View } from 'react-native';
import { AvatarImage } from '../../../components/organisms/AvatarImage';
import { authApi } from '../../../services/api/auth';
import { clearSession } from '../../../services/api/storage';
import { useMeProfile } from '../../../hooks/useMeProfile';
import { useMySettings } from '../../../hooks/useMeProfile';
import {
  registerPushNotificationsAsync,
  unregisterPushNotificationsAsync,
} from '../../../lib/push-notifications';
import { syncCurrentMealReminders, cancelMealReminders } from '../../../lib/meal-reminders';
import { Bell, CalendarDays, Clock3, Droplets, Globe2, Megaphone, MessageCircle, ShieldCheck, Sun } from '@/components/icons';
import { P, PageScaffold, PButton, PCard, PRow, PToggleRow, SectionTitle, InlineNotice } from '../ProfileUI';
import { LoadBlock, confirmAction, errMsg } from '../shared';
import { OptionSheet } from '../OptionSheet';

type ThemeCode = 'SYSTEM' | 'LIGHT' | 'DARK';
type LangCode = 'vi' | 'en';

const THEME_OPTIONS = [
  { value: 'SYSTEM' as const, label: 'Theo hệ thống', sub: 'Tự đổi theo cài đặt điện thoại' },
  { value: 'LIGHT' as const, label: 'Sáng' },
  { value: 'DARK' as const, label: 'Tối' },
];
const LANG_OPTIONS = [
  { value: 'vi' as const, label: 'Tiếng Việt' },
  { value: 'en' as const, label: 'English' },
];

function normalizeTheme(raw?: string | null): ThemeCode {
  const t = (raw ?? '').toUpperCase();
  return t === 'DARK' ? 'DARK' : t === 'LIGHT' ? 'LIGHT' : 'SYSTEM';
}

export function SettingsPage({ onLoggedOut }: { onLoggedOut?: () => void }) {
  const { me, isLoading: meLoading, error: meError, refetch: refetchMe } = useMeProfile();
  const { settings, isLoading: setLoading, error: setError, refetch: refetchSettings, patch } = useMySettings();
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<'theme' | 'lang' | null>(null);

  const loading = (meLoading && !me) || (setLoading && !settings);
  const error = !settings && setError ? errMsg(setError, 'Không tải được cài đặt.') : meError && !me ? errMsg(meError) : null;

  const apply = async (body: Record<string, unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await patch(body);
    } catch (e) {
      setActionError(errMsg(e, 'Không lưu được cài đặt.'));
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const name = me?.basic?.displayName ?? me?.displayName ?? '—';
  const username = me?.basic?.username ? `@${me.basic.username}` : '—';
  const avatarUri = me?.avatar?.url ?? me?.avatar?.thumbnailUrl ?? me?.avatarUrl;
  const theme = normalizeTheme(settings?.theme ?? settings?.appTheme);
  const lang: LangCode = settings?.language === 'en' ? 'en' : 'vi';
  const n = settings?.notifications;

  return (
    <PageScaffold>
      <LoadBlock
        loading={loading}
        error={error}
        onRetry={() => {
          void refetchMe();
          void refetchSettings();
        }}
        skeleton="form"
      >
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
            sub={n?.pushEnabled ? 'Bật thông báo trên thiết bị này' : 'Đang tắt'}
            value={!!n?.pushEnabled}
            disabled={busy}
            onChange={async (v) => {
              await apply({ pushNotificationsEnabled: v }).catch(() => undefined);
              if (v) void registerPushNotificationsAsync();
              else void unregisterPushNotificationsAsync();
            }}
          />
          <PToggleRow
            icon={Clock3}
            tint="green"
            title="Nhắc bữa ăn"
            sub="Nhắc bạn ghi lại bữa sáng, trưa, tối"
            value={!!n?.mealReminders}
            disabled={busy}
            onChange={async (v) => {
              await apply({ mealRemindersEnabled: v }).catch(() => undefined);
              if (v) void syncCurrentMealReminders();
              else void cancelMealReminders();
            }}
          />
          <PToggleRow
            icon={Droplets}
            tint="blue"
            title="Nhắc uống nước"
            sub="Gợi ý uống đủ nước trong ngày"
            value={!!n?.waterReminders}
            disabled={busy}
            onChange={(v) => void apply({ waterRemindersEnabled: v }).catch(() => undefined)}
          />
          <PToggleRow
            icon={CalendarDays}
            tint="yellow"
            title="Kế hoạch tuần"
            sub="Nhắc xem và hoàn thành kế hoạch bữa ăn"
            value={!!n?.weeklyPlanNotif}
            disabled={busy}
            onChange={(v) => void apply({ weeklyPlanNotif: v }).catch(() => undefined)}
          />
          <PToggleRow
            icon={MessageCircle}
            tint="purple"
            title="Cộng đồng"
            sub="Lượt thích, bình luận, người theo dõi mới"
            value={!!n?.communityNotif}
            disabled={busy}
            onChange={(v) => void apply({ communityNotif: v }).catch(() => undefined)}
          />
          <PToggleRow
            icon={Megaphone}
            tint="gray"
            title="Tin tức & ưu đãi"
            sub="Cập nhật tính năng và mẹo nấu ăn"
            value={!!n?.marketingNotif}
            disabled={busy}
            onChange={(v) => void apply({ marketingNotif: v }).catch(() => undefined)}
            last
          />
        </PCard>

        <SectionTitle title="Ứng dụng" />
        <PCard noPadding delay={120}>
          <PRow
            icon={Sun}
            tint="yellow"
            title="Giao diện"
            value={THEME_OPTIONS.find((o) => o.value === theme)?.label}
            onPress={() => setSheet('theme')}
          />
          <PRow
            icon={Globe2}
            tint="blue"
            title="Ngôn ngữ"
            value={LANG_OPTIONS.find((o) => o.value === lang)?.label}
            onPress={() => setSheet('lang')}
          />
          <PToggleRow
            icon={ShieldCheck}
            tint="purple"
            title="Chia sẻ dữ liệu ẩn danh"
            sub="Giúp NOAN cải thiện gợi ý món"
            value={!!(settings?.privacy?.analyticsEnabled ?? settings?.privacy?.analytics)}
            disabled={busy}
            onChange={(v) => void apply({ analyticsEnabled: v }).catch(() => undefined)}
            last
          />
        </PCard>

        {actionError ? <InlineNotice tone="error" text={actionError} /> : null}

        <PButton
          text="Đăng xuất"
          variant="danger"
          onPress={() =>
            confirmAction(
              'Đăng xuất?',
              'Bạn sẽ cần đăng nhập lại để tiếp tục dùng app.',
              () => {
                void (async () => {
                  try {
                    await authApi.logout('current');
                  } catch {
                    await clearSession();
                  }
                  onLoggedOut?.();
                })();
              },
              'Đăng xuất',
              'warning',
            )
          }
        />
      </LoadBlock>

      <OptionSheet
        visible={sheet === 'theme'}
        title="Giao diện"
        options={THEME_OPTIONS}
        value={theme}
        onClose={() => setSheet(null)}
        onSelect={(v) => {
          setSheet(null);
          void apply({ theme: v }).catch(() => undefined);
        }}
      />
      <OptionSheet
        visible={sheet === 'lang'}
        title="Ngôn ngữ"
        options={LANG_OPTIONS}
        value={lang}
        onClose={() => setSheet(null)}
        onSelect={(v) => {
          setSheet(null);
          void apply({ language: v }).catch(() => undefined);
        }}
      />
    </PageScaffold>
  );
}
