import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  History,
  Key,
  Laptop,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  Smartphone,
  Target,
  Trash2,
  Upload,
  User,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Skeleton } from '../components/ui/skeleton'
import { PageSkeleton, StatsSkeleton, TableSkeleton } from '../components/ui/page-skeleton'
import { Spinner } from '../components/ui/spinner'
import {
  useAdminUser,
  useAdminUserActions,
  useAdminUsers,
  useUserAuditEvents,
  useUserAuthAudit,
  useUserSessions,
  useUsersSummary,
} from '../hooks/useUsers'
import { usersApi, type AdminUserListItem } from '../api/users'

const avatarFallback = '/assets/avatar.jpg'

function formatNumber(n: number) {
  return new Intl.NumberFormat('vi-VN').format(n)
}

function relativeTime(iso: string | null) {
  if (!iso) return 'Chưa hoạt động'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'vừa xong'
  if (mins < 60) return `${mins} phút trước`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} ngày trước`
  return new Date(iso).toLocaleDateString('vi-VN')
}

function statusLabel(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'Hoạt động'
    case 'PENDING_VERIFICATION':
      return 'Chờ xác minh'
    case 'LOCKED':
      return 'Đã khóa'
    case 'SUSPENDED':
      return 'Bị hạn chế'
    case 'DELETED':
      return 'Đã xóa'
    default:
      return status
  }
}

function Stat({
  icon: Icon,
  value,
  label,
  tone = 'yellow',
  loading,
}: {
  icon: typeof Users
  value: string
  label: string
  tone?: 'yellow' | 'green' | 'red'
  loading?: boolean
}) {
  return (
    <Card className="stat-card">
      <div className={`metric-icon ${tone}`}>
        <Icon size={26} />
      </div>
      <div>
        {loading ? <Skeleton className="h-7 w-20 mb-1" /> : <b>{value}</b>}
        <p>{label}</p>
      </div>
    </Card>
  )
}

function UserDrawer({
  userId,
  close,
}: {
  userId: string
  close: () => void
}) {
  const { data, isLoading, isError, refetch, error } = useAdminUser(userId)
  const actions = useAdminUserActions()
  const sessions = useUserSessions(userId)
  const audit = useUserAuditEvents(userId)
  const authAudit = useUserAuthAudit(userId)

  const [activeTab, setActiveTab] = useState<'info' | 'roles' | 'sessions' | 'audit'>('info')
  const [suspendModalOpen, setSuspendModalOpen] = useState(false)
  const [suspendReason, setSuspendReason] = useState('POLICY_VIOLATION')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Clear feedback when user changes
  useEffect(() => {
    setFeedback(null)
    setSuspendModalOpen(false)
  }, [userId])

  const handlePasswordReset = async () => {
    try {
      setFeedback(null)
      await actions.passwordReset.mutateAsync(userId)
      setFeedback({ type: 'success', text: 'Đã gửi email hướng dẫn đặt lại mật khẩu.' })
    } catch (e: any) {
      setFeedback({ type: 'error', text: e?.response?.data?.message ?? 'Không thể gửi email đặt lại mật khẩu.' })
    }
  }

  const handleVerificationReminder = async () => {
    try {
      setFeedback(null)
      await actions.verificationReminder.mutateAsync(userId)
      setFeedback({ type: 'success', text: 'Đã gửi nhắc nhở xác minh email.' })
    } catch (e: any) {
      setFeedback({ type: 'error', text: e?.response?.data?.message ?? 'Không thể gửi nhắc nhở xác minh.' })
    }
  }

  const handleUnlock = async () => {
    try {
      setFeedback(null)
      await actions.unlock.mutateAsync(userId)
      setFeedback({ type: 'success', text: 'Đã mở khóa tài khoản thành công.' })
    } catch (e: any) {
      setFeedback({ type: 'error', text: e?.response?.data?.message ?? 'Không thể mở khóa tài khoản.' })
    }
  }

  const handleSuspendWithReason = async () => {
    try {
      setFeedback(null)
      await actions.suspendWithReason.mutateAsync({ userId, reasonCode: suspendReason })
      setSuspendModalOpen(false)
      setFeedback({ type: 'success', text: 'Đã hạn chế tài khoản thành công.' })
    } catch (e: any) {
      setFeedback({ type: 'error', text: e?.response?.data?.message ?? 'Không thể hạn chế tài khoản.' })
    }
  }

  const handleEndSuspension = async () => {
    if (!confirm('Bạn có chắc chắn muốn gỡ đình chỉ cho tài khoản này?')) return
    try {
      setFeedback(null)
      await actions.endSuspension.mutateAsync({
        userId,
        suspensionId: data?.activeRestriction?.id,
      })
      setFeedback({ type: 'success', text: 'Đã gỡ đình chỉ tài khoản thành công.' })
    } catch (e: any) {
      setFeedback({ type: 'error', text: e?.response?.data?.message ?? 'Không thể gỡ đình chỉ.' })
    }
  }

  const handleToggleRole = async (role: string, current: boolean) => {
    try {
      setFeedback(null)
      if (current) {
        if (!confirm(`Bạn có chắc muốn thu hồi quyền ${role}?`)) return
        await actions.revokeRole.mutateAsync({ userId, role })
        setFeedback({ type: 'success', text: `Đã thu hồi quyền ${role}.` })
      } else {
        await actions.assignRole.mutateAsync({ userId, role })
        setFeedback({ type: 'success', text: `Đã cấp quyền ${role}.` })
      }
    } catch (e: any) {
      setFeedback({ type: 'error', text: e?.response?.data?.message ?? 'Lỗi thay đổi quyền.' })
    }
  }

  const handleRevokeAllSessions = async () => {
    if (!confirm('Bạn có chắc chắn muốn thu hồi tất cả phiên đăng nhập của người dùng này?')) return
    try {
      setFeedback(null)
      await actions.revokeSessions.mutateAsync(userId)
      setFeedback({ type: 'success', text: 'Đã thu hồi tất cả phiên đăng nhập.' })
    } catch (e: any) {
      setFeedback({ type: 'error', text: e?.response?.data?.message ?? 'Không thể thu hồi phiên.' })
    }
  }

  const AVAILABLE_ROLES = [
    { id: 'SUPER_ADMIN', name: 'Super Admin', desc: 'Toàn quyền cấu hình hệ thống, xóa dữ liệu và phân quyền' },
    { id: 'CONTENT_ADMIN', name: 'Content Admin', desc: 'Quản trị công thức, bài viết chuyên sâu và danh mục' },
    { id: 'REVIEWER', name: 'Reviewer', desc: 'Thẩm duyệt món ăn và kiểm định an toàn dinh dưỡng' },
  ]

  const isSuspended = data?.account.status === 'SUSPENDED' || data?.activeRestriction != null

  return (
    <Card className="user-drawer">
      <header>
        <div className="flex items-center gap-2">
          <User size={18} className="text-amber-600" />
          <b>Chi tiết người dùng</b>
        </div>
        <button type="button" onClick={close} aria-label="Đóng bảng chi tiết">
          <X size={16} />
        </button>
      </header>

      {isLoading && <PageSkeleton rows={6} withAvatar className="p-5" />}

      {isError && (
        <div className="p-5">
          <p className="text-sm text-red-600 mb-3">
            {(error as Error)?.message ?? 'Không tải được thông tin chi tiết.'}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Thử lại
          </Button>
        </div>
      )}

      {data && (
        <>
          {/* ── Sub Navigation Tabs ── */}
          <div className="flex border-b border-border text-xs font-semibold px-4 gap-2 pt-2 bg-muted/20">
            <button
              type="button"
              onClick={() => setActiveTab('info')}
              className={`pb-2 px-2 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'info'
                  ? 'border-amber-500 text-amber-600 font-bold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <User size={14} /> Thông tin
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('roles')}
              className={`pb-2 px-2 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'roles'
                  ? 'border-amber-500 text-amber-600 font-bold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Shield size={14} /> Vai trò ({data.access.roles.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sessions')}
              className={`pb-2 px-2 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'sessions'
                  ? 'border-amber-500 text-amber-600 font-bold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Smartphone size={14} /> Phiên ({data.access.activeSessionCount ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`pb-2 px-2 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'audit'
                  ? 'border-amber-500 text-amber-600 font-bold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <History size={14} /> Lịch sử
            </button>
          </div>

          <div className="user-drawer-body">
            {/* ── Feedback Notification ── */}
            {feedback && (
              <div
                className={`p-3 mb-3 rounded-lg text-xs flex items-center gap-2 ${
                  feedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle size={16} className="text-rose-600 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}

            {/* TAB: INFO */}
            {activeTab === 'info' && (
              <>
                {/* ── Profile Hero Card ── */}
                <div className="drawer-profile-card">
                  <div className="relative">
                    <img
                      src={data.identity.avatarUrl || avatarFallback}
                      alt={data.identity.displayName ?? 'Avatar'}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = avatarFallback
                      }}
                    />
                    {data.account.status === 'ACTIVE' && (
                      <span className="online-indicator" title="Tài khoản đang hoạt động" />
                    )}
                  </div>
                  <div className="meta">
                    <b>{data.identity.displayName ?? 'Chưa đặt tên'}</b>
                    <small title={data.identity.email}>{data.identity.email}</small>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span className={`status-badge ${data.account.status.toLowerCase()}`}>
                        <span className="status-dot" />
                        {statusLabel(data.account.status)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── Mini Stats Grid ── */}
                <div className="drawer-stats-grid">
                  <div className="drawer-stat-item">
                    <b>{data.productSummary.savedDishCount}</b>
                    <span>Món đã lưu</span>
                  </div>
                  <div className="drawer-stat-item">
                    <b>{data.productSummary.randomRunCount}</b>
                    <span>Lượt random</span>
                  </div>
                  <div className="drawer-stat-item">
                    <b>{data.productSummary.publishedPostCount}</b>
                    <span>Bài viết</span>
                  </div>
                </div>

                {/* ── Detailed Info List ── */}
                <div className="drawer-info-list">
                  <div className="drawer-info-row">
                    <span>Username</span>
                    <b>{data.identity.username ?? '—'}</b>
                  </div>
                  <div className="drawer-info-row">
                    <span>Mục tiêu</span>
                    <b>{data.productSummary.primaryGoal?.name ?? 'Chưa thiết lập'}</b>
                  </div>
                  <div className="drawer-info-row">
                    <span>Trạng thái tài khoản</span>
                    <b>{statusLabel(data.account.status)}</b>
                  </div>
                  <div className="drawer-info-row">
                    <span>Vai trò</span>
                    <b>{data.access.roles.join(', ') || 'USER'}</b>
                  </div>
                  <div className="drawer-info-row">
                    <span>Phiên đang mở</span>
                    <b>{data.access.activeSessionCount ?? 0}</b>
                  </div>
                  <div className="drawer-info-row">
                    <span>Ngày tham gia</span>
                    <b>{new Date(data.account.createdAt).toLocaleDateString('vi-VN')}</b>
                  </div>
                  {data.activeRestriction != null && (
                    <div className="drawer-info-row bg-rose-50/50">
                      <span className="text-rose-700 font-medium">Hạn chế đang áp dụng</span>
                      <b className="text-rose-700">Có hiệu lực</b>
                    </div>
                  )}
                </div>

                {suspendModalOpen && (
                  <div className="p-3 my-3 border border-rose-200 bg-rose-50 rounded-lg space-y-2">
                    <b className="text-xs text-rose-900 block">Chọn lý do đình chỉ tài khoản:</b>
                    <select
                      value={suspendReason}
                      onChange={(e) => setSuspendReason(e.target.value)}
                      className="w-full text-xs border rounded p-1.5 bg-white text-slate-800"
                    >
                      <option value="POLICY_VIOLATION">Vi phạm chính sách cộng đồng (POLICY_VIOLATION)</option>
                      <option value="SPAM">Phát tán spam, quảng cáo lừa đảo (SPAM)</option>
                      <option value="HARASSMENT">Quấy rối, công kích người khác (HARASSMENT)</option>
                      <option value="SECURITY_CONCERN">Nghi ngờ xâm phạm bảo mật (SECURITY_CONCERN)</option>
                    </select>
                    <div className="flex gap-2 justify-end pt-1">
                      <Button size="sm" variant="outline" onClick={() => setSuspendModalOpen(false)}>
                        Hủy
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={actions.suspendWithReason.isPending}
                        onClick={handleSuspendWithReason}
                      >
                        {actions.suspendWithReason.isPending ? <Spinner size="sm" /> : null}
                        Xác nhận đình chỉ
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* TAB: ROLES */}
            {activeTab === 'roles' && (
              <div className="space-y-3 pt-1">
                <p className="text-xs text-muted-foreground">
                  Quản lý quyền quản trị hệ thống. Quyền Super Admin có cơ chế bảo vệ chống xóa quản trị viên cuối cùng.
                </p>
                {AVAILABLE_ROLES.map((r) => {
                  const hasIt = data.access.roles.includes(r.id)
                  const isPending =
                    actions.assignRole.isPending || actions.revokeRole.isPending
                  return (
                    <div
                      key={r.id}
                      className="p-3 rounded-lg border border-border bg-card flex items-start justify-between gap-3"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <b className="text-xs text-foreground">{r.name}</b>
                          {hasIt && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              Đang có
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">{r.desc}</p>
                      </div>
                      <Button
                        size="sm"
                        variant={hasIt ? 'danger' : 'outline'}
                        disabled={isPending}
                        onClick={() => handleToggleRole(r.id, hasIt)}
                        className="text-xs h-7 px-2 shrink-0"
                      >
                        {hasIt ? 'Gỡ quyền' : 'Cấp quyền'}
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* TAB: SESSIONS */}
            {activeTab === 'sessions' && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Các phiên đăng nhập đang hoạt động
                  </span>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={actions.revokeSessions.isPending}
                    onClick={handleRevokeAllSessions}
                    className="text-xs h-7 px-2.5"
                  >
                    <Trash2 size={12} className="mr-1" />
                    Thu hồi tất cả
                  </Button>
                </div>
                {sessions.isLoading ? (
                  <p className="text-xs text-muted-foreground text-center py-6">Đang tải danh sách phiên...</p>
                ) : !sessions.data?.items || sessions.data.items.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-foreground">
                    Không có phiên đăng nhập nào đang hoạt động.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sessions.data.items.map((s: any) => (
                      <div
                        key={s.id ?? s.sessionId}
                        className="p-2.5 rounded-lg border border-border bg-card text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between font-medium">
                          <span className="flex items-center gap-1.5 text-foreground font-semibold">
                            <Laptop size={13} className="text-muted-foreground" />
                            {s.userAgent?.slice(0, 35) || 'Thiết bị không xác định'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(s.createdAt ?? Date.now()).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>IP: {s.ip ?? s.ipHash?.slice(0, 10) ?? 'N/A'}</span>
                          <span>
                            Hoạt động: {relativeTime(s.lastActiveAt ?? s.updatedAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: AUDIT */}
            {activeTab === 'audit' && (
              <div className="space-y-4 pt-1">
                {/* Admin action audits */}
                <div>
                  <h4 className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                    <ShieldAlert size={14} className="text-amber-500" />
                    Hành động quản trị (Admin Action Audit)
                  </h4>
                  {audit.isLoading ? (
                    <p className="text-xs text-muted-foreground py-2">Đang tải lịch sử...</p>
                  ) : !audit.data?.items || audit.data.items.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">Chưa có hành động quản trị nào trên tài khoản này.</p>
                  ) : (
                    <div className="space-y-2">
                      {audit.data.items.slice(0, 10).map((ev: any) => (
                        <div key={ev.eventId} className="p-2 rounded border border-border bg-muted/20 text-xs">
                          <div className="flex items-center justify-between font-semibold">
                            <span className="text-amber-700">{ev.eventType}</span>
                            <span className="text-[10px] text-muted-foreground font-normal">
                              {new Date(ev.occurredAt).toLocaleString('vi-VN')}
                            </span>
                          </div>
                          {ev.reasonCode && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">Lý do: {ev.reasonCode}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Auth audit logs */}
                <div className="pt-2 border-t border-border">
                  <h4 className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                    <Key size={14} className="text-blue-500" />
                    Lịch sử xác thực (Auth Audit Log)
                  </h4>
                  {authAudit.isLoading ? (
                    <p className="text-xs text-muted-foreground py-2">Đang tải lịch sử đăng nhập...</p>
                  ) : !authAudit.data?.items || authAudit.data.items.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">Chưa ghi nhận sự kiện xác thực nào.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {authAudit.data.items.slice(0, 10).map((l: any) => (
                        <div key={l.id} className="p-2 rounded border border-border bg-card text-xs flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-foreground mr-1.5">{l.eventType}</span>
                            <span className={`text-[10px] px-1 py-0.2 rounded font-bold ${
                              l.result === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {l.result}
                            </span>
                            {l.platform && (
                              <span className="text-[10px] text-muted-foreground ml-2">({l.platform})</span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(l.occurredAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Drawer Actions ── */}
          {activeTab === 'info' && (
            <div className="drawer-actions-footer">
              <Button
                variant="outline"
                disabled={actions.passwordReset.isPending}
                onClick={handlePasswordReset}
              >
                {actions.passwordReset.isPending ? <Spinner size="sm" /> : null}
                Gửi đặt lại mật khẩu
              </Button>
              <Button
                variant="outline"
                disabled={actions.verificationReminder.isPending}
                onClick={handleVerificationReminder}
              >
                {actions.verificationReminder.isPending ? <Spinner size="sm" /> : null}
                Nhắc xác minh email
              </Button>
              {data.account.status === 'LOCKED' ? (
                <Button
                  disabled={actions.unlock.isPending}
                  onClick={handleUnlock}
                >
                  {actions.unlock.isPending ? <Spinner size="sm" /> : null}
                  Mở khóa bảo mật
                </Button>
              ) : isSuspended ? (
                <Button
                  variant="outline"
                  className="border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                  disabled={actions.endSuspension.isPending}
                  onClick={handleEndSuspension}
                >
                  {actions.endSuspension.isPending ? <Spinner size="sm" /> : null}
                  Gỡ đình chỉ tài khoản
                </Button>
              ) : (
                <Button
                  variant="danger"
                  disabled={actions.suspend.isPending}
                  onClick={() => setSuspendModalOpen(true)}
                >
                  Hạn chế tài khoản
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  )
}

export default function UsersPage() {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [status, setStatus] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null])
  const [isExporting, setIsExporting] = useState(false)
  const cursor = cursorStack[cursorStack.length - 1]

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    setCursorStack([null])
  }, [debouncedQ, status])

  const summary = useUsersSummary()
  const list = useAdminUsers({
    q: debouncedQ || undefined,
    status: status || undefined,
    cursor: cursor ?? undefined,
    limit: 20,
  })
  const actions = useAdminUserActions()

  const items: AdminUserListItem[] = list.data?.items ?? []
  const pageInfo = list.data?.pageInfo

  const metrics = useMemo(
    () => ({
      total: summary.data?.metrics.totalUsers ?? 0,
      active: summary.data?.metrics.activeUsersToday ?? 0,
      neu: summary.data?.metrics.newUsers ?? 0,
      restricted: summary.data?.metrics.restrictedUsers ?? 0,
    }),
    [summary.data],
  )

  const hasActiveFilter = !!(debouncedQ || status)

  const handleResetFilters = () => {
    setQ('')
    setDebouncedQ('')
    setStatus('')
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const res = await actions.createExport.mutateAsync()
      let attempts = 0
      let downloaded = false
      while (attempts < 15) {
        await new Promise((r) => setTimeout(r, 600))
        const statusRes = await usersApi.getExport(res.jobId)
        if (statusRes.status === 'READY' && statusRes.download?.url) {
          const apiBase = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001/v1').replace(/\/v1\/?$/, '')
          const downloadUrl = statusRes.download.url.startsWith('http')
            ? statusRes.download.url
            : `${apiBase}${statusRes.download.url}`

          const a = document.createElement('a')
          a.href = downloadUrl
          a.target = '_blank'
          a.setAttribute('download', `users-export-${new Date().toISOString().slice(0, 10)}.csv`)
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          downloaded = true
          break
        }
        attempts++
      }
      if (!downloaded) {
        alert('Tạo file quá thời gian, vui lòng thử lại sau.')
      }
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Không thể xuất danh sách.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Người dùng</h1>
          <p>Quản lý tài khoản, trạng thái xác minh và phân quyền truy cập hệ thống</p>
        </div>
      </div>

      {summary.isLoading ? (
        <StatsSkeleton />
      ) : (
        <div className="stats-grid">
          <Stat
            icon={Users}
            value={formatNumber(metrics.total)}
            label="Tổng người dùng"
            tone="yellow"
          />
          <Stat
            icon={Zap}
            value={formatNumber(metrics.active)}
            label="Hoạt động hôm nay"
            tone="yellow"
          />
          <Stat
            icon={UserPlus}
            value={formatNumber(metrics.neu)}
            label="Tài khoản mới"
            tone="green"
          />
          <Stat
            icon={ShieldAlert}
            value={formatNumber(metrics.restricted)}
            label="Bị hạn chế"
            tone="red"
          />
        </div>
      )}

      <div className={selectedId ? 'users-layout open' : 'users-layout'}>
        <Card className="users-table">
          {/* ── Filter Toolbar ── */}
          <div className="filters">
            <div className="search-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Tìm theo tên, username, email..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {q && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setQ('')}
                  title="Xóa tìm kiếm"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <select
              className="filter-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Lọc theo trạng thái"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">Hoạt động</option>
              <option value="PENDING_VERIFICATION">Chờ xác minh</option>
              <option value="LOCKED">Đã khóa</option>
              <option value="SUSPENDED">Bị hạn chế</option>
            </select>

            {hasActiveFilter && (
              <Button
                variant="ghost"
                size="sm"
                className="text-stone-600 hover:text-stone-900 gap-1.5"
                onClick={handleResetFilters}
              >
                <RotateCcw size={14} />
                Xóa bộ lọc
              </Button>
            )}

            <div className="filter-meta">
              <span>
                Hiển thị <b>{items.length}</b> người dùng
              </span>
            </div>

            <button
              type="button"
              className="export-btn"
              disabled={isExporting || actions.createExport.isPending}
              onClick={handleExport}
            >
              {isExporting || actions.createExport.isPending ? <Spinner size="sm" /> : <Upload size={15} />}
              {isExporting ? 'Đang xuất...' : 'Xuất danh sách'}
            </button>
          </div>

          {/* ── Loading State ── */}
          {list.isLoading && <TableSkeleton rows={8} cols={6} />}

          {/* ── Error State ── */}
          {list.isError && (
            <div className="p-8 text-center">
              <AlertCircle size={36} className="mx-auto text-rose-500 mb-2" />
              <p className="text-stone-800 font-semibold mb-1">Không tải được danh sách người dùng</p>
              <p className="text-stone-500 text-sm mb-4">
                Vui lòng kiểm tra lại kết nối mạng hoặc thử lại.
              </p>
              <Button variant="outline" onClick={() => list.refetch()}>
                Thử lại
              </Button>
            </div>
          )}

          {/* ── Empty State ── */}
          {!list.isLoading && !list.isError && items.length === 0 && (
            <div className="p-12 text-center">
              <Users size={40} className="mx-auto text-stone-300 mb-3" />
              <p className="text-stone-800 font-semibold mb-1">Không tìm thấy người dùng phù hợp</p>
              <p className="text-stone-500 text-sm mb-4">
                Thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc trạng thái.
              </p>
              {hasActiveFilter && (
                <Button variant="outline" size="sm" onClick={handleResetFilters}>
                  Xóa bộ lọc tìm kiếm
                </Button>
              )}
            </div>
          )}

          {/* ── Modern Data Table ── */}
          {!list.isLoading && !list.isError && items.length > 0 && (
            <>
              <div className="table-responsive">
                <table className="modern-data-table">
                  <thead>
                    <tr>
                      <th className="col-user">Người dùng</th>
                      <th className="col-goal">Mục tiêu</th>
                      <th className="col-status">Trạng thái</th>
                      <th className="col-activity">Hoạt động gần nhất</th>
                      <th className="col-joined">Ngày tham gia</th>
                      <th className="col-actions">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((u) => {
                      const isSelected = selectedId === u.userId
                      return (
                        <tr
                          key={u.userId}
                          className={isSelected ? 'selected-row' : ''}
                          onClick={() => setSelectedId(u.userId)}
                        >
                          {/* ── User info cell ── */}
                          <td>
                            <div className="user-cell">
                              <div className="user-avatar-wrap">
                                <img
                                  src={u.avatarUrl || avatarFallback}
                                  alt={u.displayName ?? u.username ?? 'Avatar'}
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).src = avatarFallback
                                  }}
                                />
                                {u.accountStatus === 'ACTIVE' && (
                                  <span className="online-indicator" title="Đang hoạt động" />
                                )}
                              </div>
                              <div className="user-info">
                                <span className="user-name">
                                  {u.displayName ?? u.username ?? '—'}
                                </span>
                                <span className="user-email" title={u.email}>
                                  {u.email}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* ── Primary goal cell ── */}
                          <td>
                            {u.primaryGoal ? (
                              <span className="goal-chip">
                                <Target size={12} />
                                <span>{u.primaryGoal.name}</span>
                              </span>
                            ) : (
                              <span className="goal-empty">—</span>
                            )}
                          </td>

                          {/* ── Account status cell ── */}
                          <td>
                            <span className={`status-badge ${u.accountStatus.toLowerCase()}`}>
                              <span className="status-dot" />
                              {statusLabel(u.accountStatus)}
                            </span>
                          </td>

                          {/* ── Last active cell ── */}
                          <td>
                            <div className="time-cell">
                              <Clock size={13} />
                              <span title={u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString('vi-VN') : undefined}>
                                {relativeTime(u.lastActiveAt)}
                              </span>
                            </div>
                          </td>

                          {/* ── Joined date cell ── */}
                          <td>
                            <div className="date-cell">
                              <Calendar size={13} />
                              <span>{new Date(u.joinedAt).toLocaleDateString('vi-VN')}</span>
                            </div>
                          </td>

                          {/* ── Row action button ── */}
                          <td className="col-actions">
                            <button
                              type="button"
                              className="action-icon-btn"
                              title="Xem chi tiết người dùng"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedId(u.userId)
                              }}
                            >
                              <ChevronRight size={17} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── Modern Pagination Footer ── */}
              <div className="table-pagination-footer">
                <div className="pagination-info">
                  Trang {cursorStack.length}
                </div>
                <div className="pagination-actions">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={cursorStack.length <= 1}
                    onClick={() => setCursorStack((s) => s.slice(0, -1))}
                  >
                    <ChevronLeft size={14} className="mr-1" />
                    Trang trước
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!pageInfo?.nextCursor && !(pageInfo as any)?.hasNextPage}
                    onClick={() => {
                      if (pageInfo?.nextCursor) {
                        setCursorStack((s) => [...s, pageInfo.nextCursor])
                      }
                    }}
                  >
                    Trang sau
                    <ChevronRight size={14} className="ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>

        {/* ── User Detail Drawer ── */}
        {selectedId && (
          <UserDrawer userId={selectedId} close={() => setSelectedId(null)} />
        )}
      </div>
    </>
  )
}
