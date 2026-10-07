import { useCallback, useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../../services/api/auth';
import { profileApi, type DeletionRequest, type ExportJob, type SessionItem } from '../../../services/api/profile';
import { useMySettings } from '../../../hooks/useMeProfile';
import { PROFILE_DASHBOARD_QUERY_KEY } from '../../../hooks/useProfileDashboard';
import { recordHealthMeasurementStore } from '../../../services/app-store';
import {
  ChevronDown,
  Download,
  FileText,
  Globe2,
  HeartPulse,
  History,
  LockKeyhole,
  MessageCircle,
  Smartphone,
  Trash2,
  Utensils,
} from '@/components/icons';
import { StyledPressable as Pressable } from '../../../components/ui/styled-pressable';
import { P, PageScaffold, PButton, PCard, PInput, PRow, PToggleRow, ProgressBar, SectionTitle, InlineNotice, InfoBanner } from '../ProfileUI';
import { LoadBlock, confirmAction, errMsg } from '../shared';

// ─── Privacy & security ──────────────────────────────────────────────────────

function formatSeen(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

function formatDay(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const DELETION_ACTIVE = ['PENDING_GRACE', 'QUEUED', 'PROCESSING'];

export function PrivacyPage({ onLoggedOut }: { onLoggedOut?: () => void }) {
  const qc = useQueryClient();
  const { settings, isLoading, error: queryError, refetch, patch } = useMySettings();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [deletion, setDeletion] = useState<DeletionRequest | null>(null);
  const [exportJob, setExportJob] = useState<ExportJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadExtras = useCallback(async () => {
    try {
      const [sess, del] = await Promise.all([
        authApi.getSessions().catch(() => ({ items: [] as SessionItem[] })),
        profileApi.getAccountDeletion().catch(() => null),
      ]);
      if (!mounted.current) return;
      setSessions(sess.items ?? []);
      setDeletion(del);
    } catch (e) {
      if (mounted.current) setError(errMsg(e, 'Không tải được quyền riêng tư.'));
    }
  }, []);

  useEffect(() => {
    void refetch();
    void loadExtras();
  }, [refetch, loadExtras]);

  const loading = isLoading && !settings;
  const loadError = !settings && queryError ? errMsg(queryError, 'Không tải được quyền riêng tư.') : error;

  const updateSetting = async (body: Record<string, unknown>) => {
    setBusy(true);
    setMsg(null);
    setActionError(null);
    try {
      await patch(body);
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

  const exportData = () =>
    runAction(async () => {
      let job = await profileApi.requestDataExport();
      setExportJob(job);
      for (let i = 0; i < 10 && job.status !== 'READY' && job.status !== 'COMPLETED'; i++) {
        await new Promise((r) => setTimeout(r, job.pollAfterMs ?? 2000));
        job = await profileApi.getDataExport(job.jobId);
        setExportJob(job);
      }
      const content = await profileApi.getExportContent(job.jobId);
      await Share.share({
        title: 'Dữ liệu NOAN của tôi',
        message: JSON.stringify(content, null, 2),
      });
    }, 'Đã tạo bản xuất dữ liệu.');

  const revokeSession = (s: SessionItem) =>
    confirmAction(
      s.isCurrent ? 'Đăng xuất thiết bị này?' : 'Đăng xuất thiết bị?',
      `${s.deviceLabel} sẽ bị đăng xuất khỏi tài khoản.`,
      () =>
        void runAction(async () => {
          await authApi.deleteSession(s.sessionId);
          if (s.isCurrent) {
            onLoggedOut?.();
            return;
          }
          await loadExtras();
        }, 'Đã đăng xuất thiết bị.'),
      'Đăng xuất',
      'warning',
    );

  const pwdStrength = passwordStrength(pwdNew);
  const deletionActive = !!deletion && DELETION_ACTIVE.includes(deletion.status);
  const others = sessions.filter((s) => !s.isCurrent).length;

  return (
    <PageScaffold>
      <LoadBlock loading={loading} error={loadError} onRetry={() => { void refetch(); void loadExtras(); }} skeleton="form">
        {deletionActive ? (
          <PCard style={{ borderWidth: 1, borderColor: '#FFD6CF', backgroundColor: '#FFF6F4', gap: 10 }}>
            <Text style={{ fontSize: 15.5, fontWeight: '800', color: '#C2301D' }}>Tài khoản đang chờ xoá</Text>
            <Text style={{ fontSize: 13.5, color: P.ink2, lineHeight: 19 }}>
              Tài khoản và dữ liệu sẽ bị xoá vĩnh viễn vào {formatDay(deletion?.graceEndsAt)}. Bạn có thể huỷ yêu cầu trước thời điểm này.
            </Text>
            <PButton
              text="Huỷ yêu cầu xoá"
              variant="dark"
              disabled={busy}
              onPress={() =>
                void runAction(async () => {
                  await profileApi.cancelAccountDeletion();
                  setDeletion({ jobId: null, status: 'NONE', graceEndsAt: null });
                }, 'Đã huỷ yêu cầu xoá tài khoản.')
              }
            />
          </PCard>
        ) : null}

        <SectionTitle title="Bảo mật tài khoản" />
        <PCard noPadding delay={0}>
          <PRow
            icon={LockKeyhole}
            tint="yellow"
            title="Đổi mật khẩu"
            sub={showPwd ? 'Nhập mật khẩu hiện tại và mật khẩu mới' : 'Nên đổi định kỳ để an toàn hơn'}
            onPress={() => setShowPwd((v) => !v)}
            last={!showPwd}
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
        </PCard>

        <SectionTitle
          title="Thiết bị đã đăng nhập"
          sub={`${sessions.length} thiết bị`}
          action={others > 0 ? 'Đăng xuất thiết bị khác' : undefined}
          onAction={
            others > 0
              ? () =>
                  confirmAction(
                    'Đăng xuất thiết bị khác?',
                    'Các phiên đăng nhập khác sẽ bị huỷ. Phiên hiện tại vẫn giữ.',
                    () => void runAction(async () => {
                      await authApi.deleteAllSessionsExceptCurrent();
                      await loadExtras();
                    }, 'Đã đăng xuất các thiết bị khác.'),
                    'Đăng xuất hết',
                  )
              : undefined
          }
        />
        <PCard noPadding delay={30}>
          {sessions.length === 0 ? (
            <Text style={{ padding: 16, color: P.muted, textAlign: 'center' }}>Không có phiên đăng nhập nào.</Text>
          ) : (
            sessions.map((s, i) => (
              <PRow
                key={s.sessionId}
                icon={Smartphone}
                tint={s.isCurrent ? 'green' : 'blue'}
                title={s.isCurrent ? `${s.deviceLabel} · Thiết bị này` : s.deviceLabel}
                sub={`Hoạt động ${formatSeen(s.lastSeenAt)}`}
                last={i === sessions.length - 1}
                onPress={busy ? undefined : () => revokeSession(s)}
              />
            ))
          )}
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
            onChange={(v) => updateSetting({ profileVisibility: v ? 'PUBLIC' : 'PRIVATE' })}
          />
          <PToggleRow
            icon={Utensils}
            tint="orange"
            title="Hiển thị hoạt động ăn uống"
            sub="Chuỗi ngày và bữa đã ghi trên hồ sơ"
            value={!!settings?.privacy?.showDietActivity}
            disabled={busy}
            onChange={(v) => updateSetting({ showDietActivity: v })}
          />
          <PToggleRow
            icon={MessageCircle}
            tint="blue"
            title="Cho phép bình luận"
            sub="Trên bài viết của bạn"
            value={settings?.privacy?.allowComments !== false}
            disabled={busy}
            onChange={(v) => updateSetting({ allowComments: v })}
            last
          />
        </PCard>

        <SectionTitle title="Dữ liệu của bạn" />
        <PCard noPadding delay={120}>
          <PRow
            icon={exportJob?.status === 'READY' ? Download : FileText}
            tint="purple"
            title="Tải dữ liệu của tôi"
            sub={busy && exportJob ? 'Đang chuẩn bị dữ liệu…' : 'Xuất bản sao dữ liệu (JSON) để lưu hoặc chia sẻ'}
            onPress={busy ? undefined : () => void exportData()}
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
                    void qc.invalidateQueries({ queryKey: ['profile', 'randomHistory'] });
                    void qc.invalidateQueries({ queryKey: PROFILE_DASHBOARD_QUERY_KEY });
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

        {!deletionActive ? (
          <>
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
                          'Tài khoản sẽ bị xoá sau thời gian chờ. Trong thời gian này bạn có thể huỷ yêu cầu.',
                          () =>
                            void runAction(async () => {
                              const res = await profileApi.requestAccountDeletion();
                              setDeletion(res);
                            }, 'Đã gửi yêu cầu xóa tài khoản.'),
                          'Gửi yêu cầu',
                        )
                }
              />
            </PCard>
          </>
        ) : null}
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
