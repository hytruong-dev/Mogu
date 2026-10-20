import { useEffect, useState } from 'react'
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Key,
  Laptop,
  RotateCcw,
  Search,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Target,
  Upload,
  User,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import { Badge } from '../components/ui/badge'
import { Select } from '../components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Skeleton } from '../components/ui/skeleton'
import { PageSkeleton, StatsSkeleton, TableSkeleton } from '../components/ui/page-skeleton'
import { Spinner } from '../components/ui/spinner'
import { MediaLightbox, useMediaLightbox } from '../components/ui/media-lightbox'
import { PageContainer } from '../components/layout'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import { useAuth } from '../providers/AuthProvider'
import {
  useAdminUser,
  useAdminUserActions,
  useAdminUsers,
  useUserAuditEvents,
  useUserAuthAudit,
  useUserSessions,
  useUsersSummary,
} from '../hooks/useUsers'
import { usersApi, type CreateAdminUserResponse } from '../api/users'

const avatarFallback = '/assets/avatar.jpg'

function formatNumber(n: number) {
  return new Intl.NumberFormat('vi-VN').format(n)
}

function relativeTime(iso: string | null) {
  if (!iso) return 'Chưa hoạt động'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'vừa xong'
  if (mins < 60) return `${mins}p trước`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h trước`
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
  const toneStyles = {
    yellow: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20',
    green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20',
    red: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/20',
  }

  return (
    <Card className="border-border/60 shadow-xs hover:border-amber-500/30 transition-colors">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
          {loading ? (
            <Skeleton className="h-7 w-20 mb-1" />
          ) : (
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">{value}</div>
          )}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${toneStyles[tone]}`}>
          <Icon size={20} />
        </div>
      </CardContent>
    </Card>
  )
}

function CreateUserModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const actions = useAdminUserActions()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<'USER' | 'REVIEWER' | 'CONTENT_ADMIN' | 'SUPER_ADMIN'>('USER')
  const [password, setPassword] = useState('')
  const [mustChangePassword, setMustChangePassword] = useState(true)
  const [error, setError] = useState('')
  const [result, setResult] = useState<CreateAdminUserResponse | null>(null)
  const [copied, setCopied] = useState(false)

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*'
    let pwd = 'Noan@'
    for (let i = 0; i < 6; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    pwd += '9'
    setPassword(pwd)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || username.trim().length < 3) {
      setError('Tên đăng nhập tối thiểu 3 ký tự.')
      return
    }
    setError('')
    try {
      const res = await actions.createUser.mutateAsync({
        username: username.trim().toLowerCase(),
        email: email.trim() || undefined,
        displayName: displayName.trim() || undefined,
        role,
        password: password.trim() || undefined,
        mustChangePassword,
      })
      setResult(res)
      onCreated()
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Không thể tạo tài khoản.')
    }
  }

  const handleCopy = () => {
    if (!result) return
    const text = `Tài khoản NOAN:\nTên đăng nhập: ${result.username}\nMật khẩu: ${result.temporaryPassword}\nVai trò: ${result.role}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleResetForm = () => {
    setUsername('')
    setEmail('')
    setDisplayName('')
    setRole('USER')
    setPassword('')
    setMustChangePassword(true)
    setError('')
    setResult(null)
    setCopied(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleResetForm}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus size={18} className="text-primary" />
            <span>Tạo tài khoản người dùng / Quản trị</span>
          </DialogTitle>
          <DialogDescription>
            Khởi tạo tài khoản trực tiếp trong hệ thống với vai trò và quyền hạn tương ứng.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <span>Tài khoản đã tạo thành công!</span>
              </div>
              <div className="text-xs space-y-1.5 font-mono bg-card/60 p-3 rounded-lg border border-border">
                <div><span className="text-muted-foreground font-sans">Tên đăng nhập:</span> <span className="font-bold text-foreground">{result.username}</span></div>
                {result.email && <div><span className="text-muted-foreground font-sans">Email:</span> <span className="text-foreground">{result.email}</span></div>}
                <div><span className="text-muted-foreground font-sans">Vai trò:</span> <span className="text-foreground font-semibold">{result.role}</span></div>
                <div><span className="text-muted-foreground font-sans">Mật khẩu tạm:</span> <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">{result.temporaryPassword}</span></div>
              </div>
              <p className="text-[11px] text-muted-foreground font-sans">
                {result.mustChangePassword
                  ? '⚠️ Người dùng sẽ được yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên.'
                  : 'Người dùng có thể đăng nhập ngay với mật khẩu trên.'}
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={handleCopy}
              >
                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                <span>{copied ? 'Đã sao chép!' : 'Sao chép thông tin'}</span>
              </Button>
              <Button type="button" onClick={handleResetForm} className="text-xs">
                Hoàn tất
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 py-2">
            {error && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Tên đăng nhập <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder="VD: reviewer_nam"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-8.5 text-xs"
                required
              />
              <span className="text-[10px] text-muted-foreground">3-32 ký tự, không dấu (a-z, 0-9, ., _)</span>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Email
              </label>
              <Input
                type="email"
                placeholder="VD: user@example.com (để nhận mã reset & thông báo)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-8.5 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Tên hiển thị
              </label>
              <Input
                placeholder="VD: Nguyễn Văn Nam"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-8.5 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Vai trò truy cập <span className="text-rose-500">*</span>
              </label>
              <Select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="h-8.5 text-xs w-full bg-card"
              >
                <option value="USER">Người dùng thông thường (USER)</option>
                <option value="REVIEWER">Kiểm duyệt viên món ăn (REVIEWER)</option>
                <option value="CONTENT_ADMIN">Quản trị nội dung & bài viết (CONTENT_ADMIN)</option>
                <option value="SUPER_ADMIN">Quản trị viên cấp cao (SUPER_ADMIN)</option>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">
                  Mật khẩu khởi tạo
                </label>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium cursor-pointer"
                >
                  <Sparkles size={11} />
                  <span>Tạo mật khẩu an toàn</span>
                </button>
              </div>
              <Input
                type="text"
                placeholder="Để trống để hệ thống tự sinh ngẫu nhiên"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-8.5 text-xs font-mono"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="mustChangePassword"
                checked={mustChangePassword}
                onChange={(e) => setMustChangePassword(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
              />
              <label htmlFor="mustChangePassword" className="text-xs text-foreground cursor-pointer select-none">
                Yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên
              </label>
            </div>

            <DialogFooter className="gap-2 pt-3">
              <Button type="button" variant="outline" size="sm" onClick={handleResetForm} className="text-xs">
                Hủy
              </Button>
              <Button type="submit" size="sm" disabled={actions.createUser.isPending} className="text-xs gap-1.5 font-semibold">
                {actions.createUser.isPending ? <Spinner size="sm" /> : <UserPlus size={14} />}
                <span>Tạo tài khoản</span>
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function DirectPasswordResetModal({
  open,
  userId,
  username,
  onClose,
  onSuccess,
}: {
  open: boolean
  userId: string
  username: string
  onClose: () => void
  onSuccess: (msg: string) => void
}) {
  const actions = useAdminUserActions()
  const [mode, setMode] = useState<'email' | 'direct'>('direct')
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [reasonCode, setReasonCode] = useState('ADMIN_TEMP_PASSWORD')
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*'
    let pwd = 'Noan@'
    for (let i = 0; i < 6; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    pwd += '9'
    setTemporaryPassword(pwd)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (mode === 'email') {
      try {
        await actions.passwordReset.mutateAsync(userId)
        onSuccess('Đã gửi liên kết đặt lại mật khẩu đến email người dùng.')
        onClose()
      } catch (err: any) {
        setError(err?.response?.data?.message ?? 'Không thể gửi email.')
      }
      return
    }

    try {
      const res = await actions.directPasswordReset.mutateAsync({
        userId,
        body: {
          temporaryPassword: temporaryPassword.trim() || undefined,
          reasonCode,
        },
      })
      setResult(res)
      onSuccess('Mật khẩu tạm thời đã được thiết lập.')
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Không thể đặt lại mật khẩu.')
    }
  }

  const handleCopy = () => {
    if (!result) return
    navigator.clipboard.writeText(result.temporaryPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key size={18} className="text-amber-500" />
            <span>Đặt lại mật khẩu cho {username}</span>
          </DialogTitle>
          <DialogDescription>
            Chọn phương thức khôi phục mật khẩu hoặc cấp mật khẩu tạm thời cho người dùng.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 size={18} className="text-emerald-600" />
                <span>Mật khẩu tạm thời đã sẵn sàng</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Hãy sao chép và gửi mật khẩu tạm này cho người dùng qua kênh bảo mật:
              </p>
              <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                <span className="font-mono text-base font-bold text-foreground">
                  {result.temporaryPassword}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                  onClick={handleCopy}
                >
                  {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                ⚠️ Tất cả các phiên đăng nhập cũ đã được thu hồi. Người dùng bắt buộc phải đổi mật khẩu khi đăng nhập bằng mật khẩu này.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" onClick={onClose} className="text-xs">
                Đóng
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5 py-2">
            {error && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 p-1 bg-muted/40 rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setMode('direct')}
                className={`py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  mode === 'direct' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Cấp mật khẩu tạm thời
              </button>
              <button
                type="button"
                onClick={() => setMode('email')}
                className={`py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  mode === 'email' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Gửi email khôi phục
              </button>
            </div>

            {mode === 'direct' ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground">
                      Mật khẩu tạm thời
                    </label>
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <Sparkles size={11} />
                      <span>Tự sinh ngẫu nhiên</span>
                    </button>
                  </div>
                  <Input
                    type="text"
                    placeholder="Để trống để hệ thống tự sinh ngẫu nhiên"
                    value={temporaryPassword}
                    onChange={(e) => setTemporaryPassword(e.target.value)}
                    className="h-8.5 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Lý do</label>
                  <Select
                    value={reasonCode}
                    onChange={(e) => setReasonCode(e.target.value)}
                    className="h-8.5 text-xs w-full bg-card"
                  >
                    <option value="ADMIN_TEMP_PASSWORD">Hỗ trợ hotline/ticket khẩn cấp</option>
                    <option value="SECURITY_RESET">Nghi ngờ lộ mật khẩu</option>
                    <option value="USER_REQUEST">Người dùng yêu cầu trực tiếp</option>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-muted/30 border border-border text-xs text-muted-foreground">
                Hệ thống sẽ gửi email chứa liên kết và hướng dẫn đặt lại mật khẩu đến địa chỉ email đã đăng ký của người dùng.
              </div>
            )}

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
                Hủy
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={actions.directPasswordReset.isPending || actions.passwordReset.isPending}
                className="text-xs font-semibold"
              >
                {(actions.directPasswordReset.isPending || actions.passwordReset.isPending) ? <Spinner size="sm" /> : null}
                {mode === 'direct' ? 'Thiết lập mật khẩu tạm' : 'Gửi email'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function UserDrawer({
  userId,
  close,
  onPreviewAvatar,
}: {
  userId: string
  close: () => void
  onPreviewAvatar?: (url: string, title?: string, subtitle?: string) => void
}) {
  const { data, isLoading, isError, error, refetch } = useAdminUser(userId)
  const actions = useAdminUserActions()
  const { user: currentAdmin } = useAuth()
  const isSelf = currentAdmin?.id === userId
  const [activeTab, setActiveTab] = useState<'info' | 'roles' | 'sessions' | 'audit'>('info')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [suspendReason, setSuspendReason] = useState<string>('POLICY_VIOLATION')
  const [suspendModalOpen, setSuspendModalOpen] = useState(false)
  const [resetModalOpen, setResetModalOpen] = useState(false)

  const sessions = useUserSessions(userId)
  const audit = useUserAuditEvents(userId)
  const authAudit = useUserAuthAudit(userId)

  const handleVerificationReminder = async () => {
    try {
      await actions.verificationReminder.mutateAsync(userId)
      setFeedback({ type: 'success', text: 'Đã gửi email nhắc xác minh tài khoản.' })
    } catch (e: any) {
      setFeedback({ type: 'error', text: e?.response?.data?.message ?? 'Không thể gửi email.' })
    }
  }

  const handleUnlock = async () => {
    try {
      await actions.unlock.mutateAsync(userId)
      setFeedback({ type: 'success', text: 'Đã mở khóa tài khoản người dùng.' })
    } catch (e: any) {
      setFeedback({ type: 'error', text: e?.response?.data?.message ?? 'Không thể mở khóa.' })
    }
  }

  const handleSuspendWithReason = async () => {
    try {
      await actions.suspendWithReason.mutateAsync({ userId, reasonCode: suspendReason })
      setFeedback({ type: 'success', text: 'Đã đình chỉ tài khoản theo lý do đã chọn.' })
      setSuspendModalOpen(false)
    } catch (e: any) {
      setFeedback({ type: 'error', text: e?.response?.data?.message ?? 'Không thể đình chỉ tài khoản.' })
    }
  }

  const handleEndSuspension = async () => {
    try {
      await actions.endSuspension.mutateAsync({ userId })
      setFeedback({ type: 'success', text: 'Đã gỡ bỏ hạn chế cho tài khoản.' })
    } catch (e: any) {
      setFeedback({ type: 'error', text: e?.response?.data?.message ?? 'Không thể gỡ hạn chế.' })
    }
  }

  const handleToggleRole = async (roleId: string, hasIt: boolean) => {
    try {
      if (hasIt) {
        await actions.revokeRole.mutateAsync({ userId, role: roleId })
        setFeedback({ type: 'success', text: `Đã thu hồi vai trò ${roleId}.` })
      } else {
        await actions.assignRole.mutateAsync({ userId, role: roleId })
        setFeedback({ type: 'success', text: `Đã cấp vai trò ${roleId}.` })
      }
    } catch (e: any) {
      setFeedback({ type: 'error', text: e?.response?.data?.message ?? 'Không thể cập nhật vai trò.' })
    }
  }

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await usersApi.revokeSessions(userId, {
        scope: 'SELECTED',
        sessionIds: [sessionId],
        reasonCode: 'ADMIN_REVOKE',
      })
      await sessions.refetch()
      setFeedback({ type: 'success', text: 'Đã thu hồi phiên đăng nhập.' })
    } catch (e: any) {
      setFeedback({ type: 'error', text: e?.response?.data?.message ?? 'Không thể thu hồi phiên.' })
    }
  }

  const handleRevokeAllSessions = async () => {
    try {
      await actions.revokeSessions.mutateAsync(userId)
      await sessions.refetch()
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
    <Card className="border-border/80 shadow-md flex flex-col h-fit sticky top-20">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/70 bg-card">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center ring-1 ring-amber-500/20">
            <User size={16} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-foreground">Chi tiết người dùng</h3>
              {isSelf && (
                <Badge variant="outline" className="border-amber-400 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] py-0 px-1.5 font-semibold">
                  Tài khoản của bạn
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">ID: {userId.slice(0, 12)}...</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={close}
          aria-label="Đóng bảng chi tiết"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <X size={16} />
        </Button>
      </div>

      {isLoading && <PageSkeleton rows={6} withAvatar className="p-5" />}

      {isError && (
        <div className="p-5 space-y-3">
          <p className="text-xs text-rose-600 font-medium">
            {(error as Error)?.message ?? 'Không tải được thông tin chi tiết.'}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 text-xs">
            Thử lại
          </Button>
        </div>
      )}

      {data && (
        <div className="p-4 space-y-4 max-h-[calc(100vh-180px)] overflow-y-auto">
          {/* Sub Navigation Tabs */}
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as typeof activeTab)}>
            <TabsList className="w-full grid grid-cols-4 bg-muted/50 p-1 h-9">
              <TabsTrigger value="info" className="text-xs font-semibold px-1 py-1">
                Thông tin
              </TabsTrigger>
              <TabsTrigger value="roles" className="text-xs font-semibold px-1 py-1">
                Vai trò ({data.access.roles.length})
              </TabsTrigger>
              <TabsTrigger value="sessions" className="text-xs font-semibold px-1 py-1">
                Phiên ({data.access.activeSessionCount ?? 0})
              </TabsTrigger>
              <TabsTrigger value="audit" className="text-xs font-semibold px-1 py-1">
                Lịch sử
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Feedback banner */}
          {feedback && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 animate-in fade-in-50 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle size={15} className="text-rose-600 shrink-0" />
              )}
              <span className="flex-1">{feedback.text}</span>
              <button onClick={() => setFeedback(null)} className="text-muted-foreground hover:text-foreground">
                <X size={13} />
              </button>
            </div>
          )}

          {/* TAB: INFO */}
          {activeTab === 'info' && (
            <div className="space-y-4">
              {/* Profile Card */}
              <div className="flex items-center gap-3.5 p-3 rounded-xl bg-muted/30 border border-border/60">
                <div
                  className="relative shrink-0 w-16 h-16 rounded-full overflow-hidden border-2 border-border shadow-xs cursor-zoom-in"
                  onClick={() =>
                    onPreviewAvatar?.(
                      data.identity.avatarUrl || avatarFallback,
                      data.identity.displayName ?? 'Avatar người dùng',
                      data.identity.email ?? undefined,
                    )
                  }
                >
                  <Avatar className="w-16 h-16">
                    <AvatarImage
                      src={data.identity.avatarUrl || avatarFallback}
                      alt={data.identity.displayName ?? 'Avatar'}
                      className="object-cover w-full h-full"
                    />
                    <AvatarFallback className="text-base font-bold bg-amber-500/10 text-amber-600">
                      {(data.identity.displayName ?? data.identity.email ?? 'U').slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {data.account.status === 'ACTIVE' && (
                    <span
                      className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-card"
                      title="Tài khoản đang hoạt động"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <h4 className="text-sm font-bold text-foreground truncate">
                    {data.identity.displayName ?? 'Chưa đặt tên'}
                  </h4>
                  <p className="text-xs text-muted-foreground truncate" title={data.identity.email}>
                    {data.identity.email}
                  </p>
                  <div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-semibold py-0.5 gap-1 ${
                        data.account.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                          : data.account.status === 'LOCKED' || data.account.status === 'SUSPENDED'
                          ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          data.account.status === 'ACTIVE'
                            ? 'bg-emerald-500'
                            : data.account.status === 'LOCKED' || data.account.status === 'SUSPENDED'
                            ? 'bg-rose-500'
                            : 'bg-amber-500'
                        }`}
                      />
                      {statusLabel(data.account.status)}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Product Stats Grid */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-lg bg-card border border-border text-center space-y-0.5">
                  <div className="text-base font-bold text-foreground font-mono">
                    {data.productSummary.savedDishCount}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Món đã lưu</div>
                </div>
                <div className="p-2.5 rounded-lg bg-card border border-border text-center space-y-0.5">
                  <div className="text-base font-bold text-foreground font-mono">
                    {data.productSummary.randomRunCount}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Random</div>
                </div>
                <div className="p-2.5 rounded-lg bg-card border border-border text-center space-y-0.5">
                  <div className="text-base font-bold text-foreground font-mono">
                    {data.productSummary.publishedPostCount}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Bài viết</div>
                </div>
              </div>

              {/* Info Rows */}
              <div className="divide-y divide-border/60 rounded-xl border border-border/80 bg-card overflow-hidden">
                <div className="flex items-center justify-between p-2.5 text-xs">
                  <span className="text-muted-foreground">Username</span>
                  <span className="font-semibold text-foreground font-mono">{data.identity.username ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 text-xs">
                  <span className="text-muted-foreground">Mục tiêu</span>
                  <span className="font-semibold text-foreground">
                    {data.productSummary.primaryGoal?.name ?? 'Chưa thiết lập'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 text-xs">
                  <span className="text-muted-foreground">Vai trò</span>
                  <span className="font-semibold text-foreground font-mono">
                    {data.access.roles.join(', ') || 'USER'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 text-xs">
                  <span className="text-muted-foreground">Phiên đang mở</span>
                  <span className="font-semibold text-foreground font-mono">
                    {data.access.activeSessionCount ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 text-xs">
                  <span className="text-muted-foreground">Ngày tham gia</span>
                  <span className="font-semibold text-foreground font-mono">
                    {new Date(data.account.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>
              </div>

              {/* Suspension Reason Dialog */}
              {suspendModalOpen && (
                <div className="p-3 border border-rose-200 bg-rose-50 dark:bg-rose-950/30 rounded-xl space-y-2.5 animate-in fade-in-50">
                  <span className="text-xs font-bold text-rose-900 dark:text-rose-300 block">
                    Chọn lý do đình chỉ tài khoản:
                  </span>
                  <Select
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    className="w-full text-xs bg-card"
                  >
                    <option value="POLICY_VIOLATION">Vi phạm chính sách cộng đồng (POLICY_VIOLATION)</option>
                    <option value="SPAM">Phát tán spam, quảng cáo lừa đảo (SPAM)</option>
                    <option value="HARASSMENT">Quấy rối, công kích người khác (HARASSMENT)</option>
                    <option value="SECURITY_CONCERN">Nghi ngờ xâm phạm bảo mật (SECURITY_CONCERN)</option>
                  </Select>
                  <div className="flex gap-2 justify-end pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSuspendModalOpen(false)}
                      className="h-8 text-xs"
                    >
                      Hủy
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={actions.suspendWithReason.isPending}
                      onClick={handleSuspendWithReason}
                      className="h-8 text-xs font-semibold"
                    >
                      {actions.suspendWithReason.isPending ? <Spinner size="sm" /> : null}
                      Xác nhận đình chỉ
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: ROLES */}
          {activeTab === 'roles' && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Quản lý quyền quản trị hệ thống. Quyền Super Admin có cơ chế bảo vệ chống xóa quản trị viên cuối cùng.
              </p>
              {AVAILABLE_ROLES.map((r) => {
                const hasIt = data.access.roles.includes(r.id)
                const isPending = actions.assignRole.isPending || actions.revokeRole.isPending
                return (
                  <div
                    key={r.id}
                    className="p-3 rounded-xl border border-border bg-card flex items-start justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">{r.name}</span>
                        {hasIt && (
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 py-0 font-semibold">
                            Đang có
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{r.desc}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={hasIt ? 'destructive' : 'outline'}
                      disabled={isPending}
                      onClick={() => handleToggleRole(r.id, hasIt)}
                      className="text-xs h-7 px-2.5 shrink-0"
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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Phiên đăng nhập đang hoạt động</span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actions.revokeSessions.isPending || !sessions.data?.items?.length}
                  onClick={handleRevokeAllSessions}
                  className="text-xs h-7 px-2 text-rose-600 hover:text-rose-700"
                >
                  Đăng xuất tất cả
                </Button>
              </div>

              {sessions.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full rounded-lg" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                </div>
              ) : !sessions.data?.items || sessions.data.items.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Không có phiên đăng nhập nào đang hoạt động.</p>
              ) : (
                <div className="space-y-2">
                  {sessions.data.items.map((s: any) => (
                    <div key={s.id} className="p-2.5 rounded-lg border border-border bg-card text-xs space-y-1.5">
                      <div className="flex items-center justify-between font-medium">
                        <span className="flex items-center gap-1.5 text-foreground">
                          {s.deviceType === 'MOBILE' ? <Smartphone size={13} /> : <Laptop size={13} />}
                          {s.deviceName ?? 'Thiết bị'}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[11px] text-rose-600 hover:bg-rose-50"
                          onClick={() => handleRevokeSession(s.id)}
                        >
                          Thu hồi
                        </Button>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>IP: {s.ip ?? s.ipHash?.slice(0, 10) ?? 'N/A'}</span>
                        <span>Hoạt động: {relativeTime(s.lastActiveAt ?? s.updatedAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: AUDIT */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                  <ShieldAlert size={14} className="text-amber-500" />
                  Hành động quản trị (Admin Action Audit)
                </h4>
                {audit.isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full rounded-lg" />
                  </div>
                ) : !audit.data?.items || audit.data.items.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">Chưa có hành động quản trị nào trên tài khoản này.</p>
                ) : (
                  <div className="space-y-1.5">
                    {audit.data.items.slice(0, 10).map((ev: any) => (
                      <div key={ev.eventId} className="p-2 rounded-lg border border-border bg-muted/20 text-xs">
                        <div className="flex items-center justify-between font-semibold">
                          <span className="text-amber-600 dark:text-amber-400">{ev.eventType}</span>
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

              <div className="pt-2 border-t border-border">
                <h4 className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                  <Key size={14} className="text-blue-500" />
                  Lịch sử xác thực (Auth Audit Log)
                </h4>
                {authAudit.isLoading ? (
                  <div className="space-y-1.5">
                    <Skeleton className="h-9 w-full rounded-md" />
                  </div>
                ) : !authAudit.data?.items || authAudit.data.items.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">Chưa ghi nhận sự kiện xác thực nào.</p>
                ) : (
                  <div className="space-y-1.5">
                    {authAudit.data.items.slice(0, 10).map((l: any) => (
                      <div key={l.id} className="p-2 rounded-lg border border-border bg-card text-xs flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-foreground">{l.action}</span>
                          <span className="text-[10px] text-muted-foreground ml-2">{l.ip ?? 'N/A'}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(l.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick Actions Footer */}
          <div className="pt-3 border-t border-border/70 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResetModalOpen(true)}
              className="text-xs h-8 gap-1.5"
            >
              <Key size={13} className="text-amber-500" />
              <span>Đặt lại mật khẩu</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={actions.verificationReminder.isPending}
              onClick={handleVerificationReminder}
              className="text-xs h-8"
            >
              {actions.verificationReminder.isPending ? <Spinner size="sm" /> : null}
              Nhắc xác minh
            </Button>
            {data.account.status === 'LOCKED' ? (
              <Button
                size="sm"
                disabled={actions.unlock.isPending}
                onClick={handleUnlock}
                className="text-xs h-8 bg-amber-500 hover:bg-amber-600 text-white"
              >
                {actions.unlock.isPending ? <Spinner size="sm" /> : null}
                Mở khóa bảo mật
              </Button>
            ) : isSuspended ? (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                disabled={actions.endSuspension.isPending}
                onClick={handleEndSuspension}
              >
                {actions.endSuspension.isPending ? <Spinner size="sm" /> : null}
                Gỡ đình chỉ
              </Button>
            ) : (
              <Button
                variant="destructive"
                size="sm"
                disabled={isSelf || actions.suspend.isPending}
                onClick={() => setSuspendModalOpen(true)}
                title={isSelf ? 'Không thể hạn chế tài khoản của chính bạn' : undefined}
                className="text-xs h-8"
              >
                Hạn chế tài khoản
              </Button>
            )}
          </div>

          <DirectPasswordResetModal
            open={resetModalOpen}
            userId={userId}
            username={data.identity.username || 'user'}
            onClose={() => setResetModalOpen(false)}
            onSuccess={(text) => setFeedback({ type: 'success', text })}
          />
        </div>
      )}
    </Card>
  )
}

export default function UsersPage() {
  const { lightboxProps, openImage } = useMediaLightbox()
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [status, setStatus] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null])
  const [isExporting, setIsExporting] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const cursor = cursorStack[cursorStack.length - 1]

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  const list = useAdminUsers({
    q: debouncedQ || undefined,
    status: status || undefined,
    cursor: cursor || undefined,
    limit: 20,
  })

  const summary = useUsersSummary()
  const actions = useAdminUserActions()

  const metrics = summary.data?.metrics ?? {
    totalUsers: 0,
    activeUsersToday: 0,
    newUsers: 0,
    restrictedUsers: 0,
  }

  const items = list.data?.items ?? []
  const pageInfo = list.data?.pageInfo

  const hasActiveFilter = Boolean(q || status)

  const handleResetFilters = () => {
    setQ('')
    setStatus('')
    setCursorStack([null])
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const res = await actions.createExport.mutateAsync()
      const jobId = res?.jobId ?? (res as any)?.id
      if (!jobId) {
        alert('Không khởi tạo được tác vụ xuất file.')
        return
      }

      let attempts = 0
      let downloaded = false
      while (attempts < 20 && !downloaded) {
        await new Promise((r) => setTimeout(r, 1500))
        const statusRes = await usersApi.getExport(jobId)
        if (statusRes.status === 'COMPLETED' && statusRes.downloadUrl) {
          window.open(statusRes.downloadUrl, '_blank')
          downloaded = true
          break
        }
        if (statusRes.status === 'FAILED') {
          alert('Xuất danh sách thất bại: ' + (statusRes.error ?? 'Lỗi không xác định.'))
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
    <PageContainer className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20">
              <Users size={22} />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Quản lý người dùng
                <Badge variant="secondary" className="font-mono text-xs font-semibold">
                  {formatNumber(metrics.totalUsers)} tài khoản
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quản lý tài khoản, trạng thái xác minh và phân quyền truy cập hệ thống NOAN.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            type="button"
            className="h-9 gap-1.5 font-semibold text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs cursor-pointer"
            onClick={() => setCreateModalOpen(true)}
          >
            <UserPlus size={14} />
            <span>Tạo tài khoản mới</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-9 gap-1.5 font-semibold text-xs shadow-2xs"
            disabled={isExporting || actions.createExport.isPending}
            onClick={handleExport}
          >
            {isExporting || actions.createExport.isPending ? <Spinner size="sm" /> : <Upload size={14} />}
            <span>{isExporting ? 'Đang xuất...' : 'Xuất danh sách'}</span>
          </Button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      {summary.isLoading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Stat icon={Users} value={formatNumber(metrics.totalUsers)} label="Tổng người dùng" tone="yellow" />
          <Stat icon={Zap} value={formatNumber(metrics.activeUsersToday)} label="Hoạt động hôm nay" tone="yellow" />
          <Stat icon={UserPlus} value={formatNumber(metrics.newUsers)} label="Tài khoản mới" tone="green" />
          <Stat icon={ShieldAlert} value={formatNumber(metrics.restrictedUsers)} label="Bị hạn chế" tone="red" />
        </div>
      )}

      {/* ── Filter Toolbar ── */}
      <Card className="border-border/60 shadow-xs">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Tìm theo tên, username, email..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9 pr-8 h-9 text-xs bg-muted/30 focus-visible:bg-card"
              />
              {q && (
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setQ('')}
                  title="Xóa tìm kiếm"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <Select
              className="w-44 h-9 text-xs bg-muted/30"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Lọc theo trạng thái"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">Hoạt động</option>
              <option value="PENDING_VERIFICATION">Chờ xác minh</option>
              <option value="LOCKED">Đã khóa</option>
              <option value="SUSPENDED">Bị hạn chế</option>
            </Select>

            {hasActiveFilter && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground gap-1.5 h-9 text-xs"
                onClick={handleResetFilters}
              >
                <RotateCcw size={13} />
                Xóa lọc
              </Button>
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            Hiển thị <strong className="text-foreground font-mono">{items.length}</strong> người dùng
          </div>
        </CardContent>
      </Card>

      {/* ── Layout Grid: Table + Detail Drawer ── */}
      <div className={`grid grid-cols-1 ${selectedId ? 'xl:grid-cols-12 gap-6' : ''}`}>
        <Card className={`border-border/60 shadow-xs overflow-hidden ${selectedId ? 'xl:col-span-7 2xl:col-span-8' : 'w-full'}`}>
          {/* Loading State */}
          {list.isLoading && <TableSkeleton rows={8} cols={6} />}

          {/* Error State */}
          {list.isError && (
            <div className="p-8 text-center space-y-3">
              <AlertCircle size={36} className="mx-auto text-rose-500" />
              <div className="space-y-1">
                <p className="text-foreground font-semibold text-sm">Không tải được danh sách người dùng</p>
                <p className="text-muted-foreground text-xs">Vui lòng kiểm tra lại kết nối mạng hoặc thử lại.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => list.refetch()} className="h-8 text-xs">
                Thử lại
              </Button>
            </div>
          )}

          {/* Empty State */}
          {!list.isLoading && !list.isError && items.length === 0 && (
            <div className="p-12 text-center space-y-3">
              <Users size={36} className="mx-auto text-muted-foreground/40" />
              <div className="space-y-1">
                <p className="text-foreground font-semibold text-sm">Không tìm thấy người dùng phù hợp</p>
                <p className="text-muted-foreground text-xs">Thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc trạng thái.</p>
              </div>
              {hasActiveFilter && (
                <Button variant="outline" size="sm" onClick={handleResetFilters} className="h-8 text-xs">
                  Xóa bộ lọc tìm kiếm
                </Button>
              )}
            </div>
          )}

          {/* Table Data */}
          {!list.isLoading && !list.isError && items.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="min-w-[220px]">Người dùng</TableHead>
                      <TableHead className="w-[140px]">Mục tiêu</TableHead>
                      <TableHead className="w-[130px]">Trạng thái</TableHead>
                      <TableHead className="w-[140px]">Hoạt động</TableHead>
                      <TableHead className="w-[120px]">Tham gia</TableHead>
                      <TableHead className="w-[70px] text-right">Chi tiết</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((u) => {
                      const isSelected = selectedId === u.userId
                      return (
                        <TableRow
                          key={u.userId}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-amber-50/70 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/30' : 'hover:bg-muted/40'
                          }`}
                          onClick={() => setSelectedId(isSelected ? null : u.userId)}
                        >
                          {/* User info cell */}
                          <TableCell className="max-w-[260px]">
                            <div className="flex items-center gap-3">
                              <div
                                className="relative shrink-0 w-10 h-10 rounded-full overflow-hidden border border-border shadow-xs cursor-zoom-in"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openImage(u.avatarUrl || avatarFallback, u.displayName ?? u.username ?? 'Avatar người dùng', u.email)
                                }}
                              >
                                <Avatar className="w-10 h-10">
                                  <AvatarImage
                                    src={u.avatarUrl || avatarFallback}
                                    alt={u.displayName ?? u.username ?? 'Avatar'}
                                    className="object-cover w-full h-full"
                                  />
                                  <AvatarFallback className="text-xs font-bold bg-amber-500/10 text-amber-600">
                                    {(u.displayName ?? u.username ?? 'U').slice(0, 1).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                {u.accountStatus === 'ACTIVE' && (
                                  <span
                                    className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-card"
                                    title="Đang hoạt động"
                                  />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="font-semibold text-xs text-foreground truncate block">
                                  {u.displayName ?? u.username ?? 'Chưa đặt tên'}
                                </span>
                                <span className="text-[11px] text-muted-foreground truncate block" title={u.email}>
                                  {u.email}
                                </span>
                              </div>
                            </div>
                          </TableCell>

                          {/* Goal cell */}
                          <TableCell>
                            {u.primaryGoal ? (
                              <Badge
                                variant="outline"
                                className="text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1.5 py-0.5"
                              >
                                <Target size={12} />
                                <span className="truncate max-w-[100px]">{u.primaryGoal.name}</span>
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          {/* Status cell */}
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[11px] font-semibold gap-1.5 py-0.5 ${
                                u.accountStatus === 'ACTIVE'
                                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                  : u.accountStatus === 'LOCKED' || u.accountStatus === 'SUSPENDED'
                                  ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                                  : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  u.accountStatus === 'ACTIVE'
                                    ? 'bg-emerald-500'
                                    : u.accountStatus === 'LOCKED' || u.accountStatus === 'SUSPENDED'
                                    ? 'bg-rose-500'
                                    : 'bg-amber-500'
                                }`}
                              />
                              {statusLabel(u.accountStatus)}
                            </Badge>
                          </TableCell>

                          {/* Last active cell */}
                          <TableCell className="text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <Clock size={13} className="text-muted-foreground/70 shrink-0" />
                              <span title={u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString('vi-VN') : undefined}>
                                {relativeTime(u.lastActiveAt)}
                              </span>
                            </div>
                          </TableCell>

                          {/* Joined date cell */}
                          <TableCell className="text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5 font-mono">
                              <Calendar size={13} className="text-muted-foreground/70 shrink-0" />
                              <span>{new Date(u.joinedAt).toLocaleDateString('vi-VN')}</span>
                            </div>
                          </TableCell>

                          {/* Action cell */}
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={`h-7 w-7 text-muted-foreground hover:text-foreground ${
                                isSelected ? 'bg-amber-500/20 text-amber-700' : ''
                              }`}
                              title="Xem chi tiết người dùng"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedId(isSelected ? null : u.userId)
                              }}
                            >
                              <ChevronRight size={15} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination footer */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
                <div className="text-xs text-muted-foreground">
                  Trang <span className="font-semibold text-foreground font-mono">{cursorStack.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={cursorStack.length <= 1}
                    onClick={() => setCursorStack((s) => s.slice(0, -1))}
                    className="h-8 text-xs font-semibold"
                  >
                    <ChevronLeft size={13} className="mr-1" />
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
                    className="h-8 text-xs font-semibold"
                  >
                    Trang sau
                    <ChevronRight size={13} className="ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>

        {/* User Detail Drawer (when selected) */}
        {selectedId && (
          <div className="xl:col-span-5 2xl:col-span-4">
            <UserDrawer
              userId={selectedId}
              close={() => setSelectedId(null)}
              onPreviewAvatar={openImage}
            />
          </div>
        )}
      </div>

      <CreateUserModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={() => {
          list.refetch()
          summary.refetch()
        }}
      />

      <MediaLightbox {...lightboxProps} />
    </PageContainer>
  )
}
