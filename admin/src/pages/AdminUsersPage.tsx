import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck,
  UserPlus,
  Key,
  Shield,
  Search,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Copy,
  Check,
  Laptop,
} from 'lucide-react'
import { PageContainer } from '../components/layout'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Skeleton } from '../components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import {
  useAdminUser,
  useAdminUserActions,
  useAdminUsers,
  useUserSessions,
} from '../hooks/useUsers'
import { type CreateAdminUserResponse } from '../api/users'

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

function RoleBadge({ role }: { role: string }) {
  switch (role) {
    case 'SUPER_ADMIN':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
          <Shield className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          Super Admin
        </span>
      )
    case 'CONTENT_ADMIN':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
          <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          Biên tập Nội dung
        </span>
      )
    case 'REVIEWER':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          Kiểm duyệt viên
        </span>
      )
    default:
      return <Badge variant="outline">{role}</Badge>
  }
}

export default function AdminUsersPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'SUPER_ADMIN' | 'CONTENT_ADMIN' | 'REVIEWER'>('ALL')
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Direct reset password states
  const [directResetOpen, setDirectResetOpen] = useState(false)
  const [directResetUser, setDirectResetUser] = useState<{ userId: string; username: string } | null>(null)
  const [directResetPassword, setDirectResetPassword] = useState('')
  const [directResetSuccess, setDirectResetSuccess] = useState<string | null>(null)
  const [directResetCopied, setDirectResetCopied] = useState(false)

  // Form states for creating admin
  const [newUsername, setNewUsername] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'SUPER_ADMIN' | 'CONTENT_ADMIN' | 'REVIEWER'>('CONTENT_ADMIN')
  const [createdResult, setCreatedResult] = useState<CreateAdminUserResponse | null>(null)
  const [copiedPass, setCopiedPass] = useState(false)

  const { data: usersData, isLoading, refetch } = useAdminUsers({
    type: 'ADMIN',
    q: search || undefined,
  })

  const { createUser, directPasswordReset, revokeSessions } = useAdminUserActions()
  const isSubmitting = createUser.isPending || directPasswordReset.isPending

  const { data: userDetail, isLoading: detailLoading } = useAdminUser(selectedUserId)
  const { data: sessionsData } = useUserSessions(selectedUserId)

  const adminList = (usersData?.items ?? []).filter((item) => {
    if (roleFilter === 'ALL') return true
    return item.roles?.includes(roleFilter)
  })

  const superAdminCount = (usersData?.items ?? []).filter((i) => i.roles?.includes('SUPER_ADMIN')).length
  const contentAdminCount = (usersData?.items ?? []).filter((i) => i.roles?.includes('CONTENT_ADMIN')).length
  const reviewerCount = (usersData?.items ?? []).filter((i) => i.roles?.includes('REVIEWER')).length

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUsername.trim()) return
    try {
      const res = await createUser.mutateAsync({
        username: newUsername.trim(),
        email: newEmail.trim() || undefined,
        displayName: newDisplayName.trim() || undefined,
        password: newPassword.trim() || undefined,
        role: newRole,
        mustChangePassword: false,
      })
      setCreatedResult(res)
      refetch()
    } catch (err: any) {
      alert(`Lỗi tạo tài khoản: ${err?.response?.data?.message || err.message}`)
    }
  }

  const handleDirectReset = async () => {
    if (!directResetUser) return
    try {
      const res = await directPasswordReset.mutateAsync({
        userId: directResetUser.userId,
        body: {
          temporaryPassword: directResetPassword.trim() || undefined,
          reasonCode: 'ADMIN_DIRECT_RESET',
        },
      })
      setDirectResetSuccess(res.temporaryPassword)
      refetch()
    } catch (err: any) {
      alert(`Lỗi đặt mật khẩu: ${err?.response?.data?.message || err.message}`)
    }
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center ring-1 ring-purple-500/20">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Quản lý Nhân sự & Phân quyền Admin
                </h1>
                <p className="text-xs text-muted-foreground">
                  Phân chia vai trò, kiểm soát tài khoản quản trị nội bộ và nhật ký tác vụ
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/users')}
              className="text-xs flex items-center gap-1.5 border-slate-200 dark:border-slate-800 hover:border-amber-500/40 text-slate-700 dark:text-slate-300"
            >
              <Users size={14} className="text-amber-500" />
              Xem Người dùng App & Thói quen
              <ArrowRight size={13} />
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setCreatedResult(null)
                setNewUsername('')
                setNewEmail('')
                setNewDisplayName('')
                setNewPassword('')
                setNewRole('CONTENT_ADMIN')
                setCreateOpen(true)
              }}
              className="text-xs bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 shadow-sm shadow-purple-500/20"
            >
              <UserPlus size={14} />
              Thêm Nhân sự Mới
            </Button>
          </div>
        </div>

        {/* Quick KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border/60 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">Tổng Nhân sự</span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
                  {usersData?.items?.length ?? 0}
                </p>
                <span className="text-[10px] text-muted-foreground">Có quyền truy cập Admin</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <Shield size={18} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">Super Admin</span>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-0.5">{superAdminCount}</p>
                <span className="text-[10px] text-muted-foreground">Toàn quyền hệ thống</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <ShieldAlert size={18} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">Content Admin</span>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-0.5">{contentAdminCount}</p>
                <span className="text-[10px] text-muted-foreground">Quản lý món, bài viết</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Sparkles size={18} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">Reviewer</span>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{reviewerCount}</p>
                <span className="text-[10px] text-muted-foreground">Kiểm duyệt nội dung</span>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <ShieldCheck size={18} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm nhân sự, username..."
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {(['ALL', 'SUPER_ADMIN', 'CONTENT_ADMIN', 'REVIEWER'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  roleFilter === r
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {r === 'ALL'
                  ? 'Tất cả vai trò'
                  : r === 'SUPER_ADMIN'
                  ? 'Super Admin'
                  : r === 'CONTENT_ADMIN'
                  ? 'Content Admin'
                  : 'Reviewer'}
              </button>
            ))}
          </div>
        </div>

        {/* Admin Staff Table */}
        <Card className="border-border/60 shadow-xs overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50/80 dark:bg-slate-800/40">
              <TableRow>
                <TableHead className="w-12 text-center text-xs">#</TableHead>
                <TableHead className="text-xs">Nhân sự Quản trị</TableHead>
                <TableHead className="text-xs">Vai trò</TableHead>
                <TableHead className="text-xs">Email nội bộ</TableHead>
                <TableHead className="text-xs">Lần đăng nhập cuối</TableHead>
                <TableHead className="text-xs">Trạng thái</TableHead>
                <TableHead className="text-right text-xs">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7} className="p-4">
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : adminList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-xs">
                    Không tìm thấy nhân sự phù hợp
                  </TableCell>
                </TableRow>
              ) : (
                adminList.map((user, idx) => (
                  <TableRow key={user.userId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <TableCell className="text-center text-xs text-muted-foreground font-mono">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-12 h-12 rounded-xl ring-2 ring-purple-500/20 shadow-xs border border-border/80 overflow-hidden shrink-0 bg-white dark:bg-slate-900">
                          <AvatarImage src={user.avatarUrl ?? undefined} alt={user.displayName ?? 'Admin'} className="object-cover w-full h-full" />
                          <AvatarFallback className="bg-purple-100 text-purple-700 font-bold text-xs">
                            {user.displayName?.charAt(0) || user.username?.charAt(0) || 'A'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                            {user.displayName || 'Nhân sự Mogu'}
                          </div>
                          <div className="text-[11px] font-mono text-purple-600 dark:text-purple-400">
                            @{user.username}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles && user.roles.length > 0 ? (
                          user.roles.map((r) => <RoleBadge key={r} role={r} />)
                        ) : (
                          <RoleBadge role="SUPER_ADMIN" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-slate-600 dark:text-slate-300">
                      {user.email || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock size={13} className="text-slate-400" />
                        {relativeTime(user.lastActiveAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 size={11} />
                        Hoạt động
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDirectResetUser({ userId: user.userId, username: user.username || 'admin' })
                            setDirectResetPassword('')
                            setDirectResetSuccess(null)
                            setDirectResetCopied(false)
                            setDirectResetOpen(true)
                          }}
                          className="h-8 px-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                          title="Cấp lại mật khẩu"
                        >
                          <Key size={14} className="mr-1" />
                          Đổi MK
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUserId(user.userId)
                            setDetailOpen(true)
                          }}
                          className="h-8 px-2.5 text-xs text-slate-700 dark:text-slate-200"
                        >
                          Chi tiết
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Modal: Thêm Nhân sự mới */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-purple-700 dark:text-purple-400">
                <UserPlus size={18} />
                Thêm Nhân sự Quản trị Mới
              </DialogTitle>
              <DialogDescription className="text-xs">
                Tài khoản sẽ được cấp quyền truy cập vào NOAN Admin Studio tương ứng theo vai trò.
              </DialogDescription>
            </DialogHeader>

            {createdResult ? (
              <div className="space-y-4 py-2">
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200">
                  <div className="font-semibold flex items-center gap-1.5 mb-1 text-sm">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    Đã tạo nhân sự thành công!
                  </div>
                  <p>Hãy lưu lại thông tin tài khoản bên dưới để bàn giao cho nhân viên:</p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-2 text-xs font-mono">
                  <div>
                    <span className="text-muted-foreground">Username:</span>{' '}
                    <strong className="text-purple-600 dark:text-purple-400">{createdResult.username}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email:</span> {createdResult.email}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Vai trò:</span>{' '}
                    <strong className="text-slate-900 dark:text-white">{createdResult.role}</strong>
                  </div>
                  {createdResult.temporaryPassword && (
                    <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded flex items-center justify-between">
                      <div>
                        <span className="text-muted-foreground text-[11px]">Mật khẩu khởi tạo:</span>
                        <div className="font-bold text-amber-700 dark:text-amber-400">
                          {createdResult.temporaryPassword}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(createdResult.temporaryPassword || '')
                          setCopiedPass(true)
                          setTimeout(() => setCopiedPass(false), 2000)
                        }}
                        className="h-7 text-xs"
                      >
                        {copiedPass ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      </Button>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button size="sm" onClick={() => setCreateOpen(false)} className="w-full text-xs">
                    Hoàn tất & Đóng
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <form onSubmit={handleCreateAdmin} className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Tên đăng nhập (Username) <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    required
                    placeholder="ví dụ: noan.content2"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Họ và tên hiển thị</label>
                  <Input
                    placeholder="ví dụ: Nguyễn Văn A"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Email công việc</label>
                  <Input
                    type="email"
                    placeholder="ví dụ: content2@noan.vn"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Vai trò & Phân quyền <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewRole('CONTENT_ADMIN')}
                      className={`p-2 rounded-lg border text-xs text-left transition-all ${
                        newRole === 'CONTENT_ADMIN'
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold ring-1 ring-blue-500/20'
                          : 'border-border hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="font-bold">Content Admin</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Kho món, bài viết</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewRole('REVIEWER')}
                      className={`p-2 rounded-lg border text-xs text-left transition-all ${
                        newRole === 'REVIEWER'
                          ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-semibold ring-1 ring-amber-500/20'
                          : 'border-border hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="font-bold">Reviewer</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Kiểm duyệt món ăn</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewRole('SUPER_ADMIN')}
                      className={`p-2 rounded-lg border text-xs text-left transition-all ${
                        newRole === 'SUPER_ADMIN'
                          ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-semibold ring-1 ring-purple-500/20'
                          : 'border-border hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="font-bold">Super Admin</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Toàn quyền hệ thống</div>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Mật khẩu khởi tạo (Để trống sẽ tự sinh ngẫu nhiên)
                  </label>
                  <Input
                    type="password"
                    placeholder="Mật khẩu tối thiểu 8 ký tự..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCreateOpen(false)}
                    className="text-xs"
                  >
                    Hủy
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmitting || !newUsername.trim()}
                    className="text-xs bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {isSubmitting ? 'Đang tạo...' : 'Tạo Tài khoản'}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal: Đổi Mật khẩu Trực tiếp */}
        <Dialog open={directResetOpen} onOpenChange={setDirectResetOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-amber-600">
                <Key size={18} />
                Cấp Mật khẩu Mới Trực tiếp
              </DialogTitle>
              <DialogDescription className="text-xs">
                Đặt lại mật khẩu cho nhân sự <strong>@{directResetUser?.username}</strong>.
              </DialogDescription>
            </DialogHeader>

            {directResetSuccess ? (
              <div className="space-y-4 py-2">
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200">
                  <div className="font-semibold flex items-center gap-1.5 mb-1 text-sm">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    Đã đổi mật khẩu thành công!
                  </div>
                  <p>Mật khẩu mới đã có hiệu lực ngay lập tức.</p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-between font-mono text-xs">
                  <div>
                    <span className="text-muted-foreground text-[11px] block">Mật khẩu mới:</span>
                    <strong className="text-sm text-slate-900 dark:text-white">{directResetSuccess}</strong>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(directResetSuccess)
                      setDirectResetCopied(true)
                      setTimeout(() => setDirectResetCopied(false), 2000)
                    }}
                    className="h-8 text-xs"
                  >
                    {directResetCopied ? (
                      <span className="text-emerald-600 flex items-center gap-1">
                        <Check size={14} /> Đã sao chép
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Copy size={14} /> Sao chép
                      </span>
                    )}
                  </Button>
                </div>

                <DialogFooter>
                  <Button size="sm" onClick={() => setDirectResetOpen(false)} className="w-full text-xs">
                    Đóng
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Mật khẩu mới (Để trống để hệ thống tự tạo mật khẩu an toàn)
                  </label>
                  <Input
                    type="text"
                    placeholder="ví dụ: Noan@2026Secure!"
                    value={directResetPassword}
                    onChange={(e) => setDirectResetPassword(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDirectResetOpen(false)}
                    className="text-xs"
                  >
                    Hủy
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleDirectReset}
                    disabled={isSubmitting}
                    className="text-xs bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {isSubmitting ? 'Đang cập nhật...' : 'Xác nhận Đổi MK'}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal: Chi tiết Nhân sự */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <ShieldCheck size={18} className="text-purple-600" />
                Hồ sơ Nhân sự Quản trị
              </DialogTitle>
            </DialogHeader>

            {detailLoading ? (
              <div className="py-8 space-y-3">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : userDetail ? (
              <div className="space-y-4 py-2 text-xs">
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700">
                  <Avatar className="w-14 h-14 rounded-2xl ring-2 ring-purple-500/30 shadow-sm border border-border overflow-hidden shrink-0 bg-white dark:bg-slate-900">
                    <AvatarImage src={userDetail.identity.avatarUrl ?? undefined} alt={userDetail.identity.displayName ?? 'Nhân sự'} className="object-cover w-full h-full" />
                    <AvatarFallback className="bg-purple-100 text-purple-700 font-bold">
                      {userDetail.identity.displayName?.charAt(0) || 'A'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {userDetail.identity.displayName || 'Nhân sự'}
                    </div>
                    <div className="text-muted-foreground font-mono">@{userDetail.identity.username}</div>
                    <div className="text-muted-foreground font-mono">{userDetail.identity.email}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {userDetail.access.roles.map((r) => (
                      <RoleBadge key={r} role={r} />
                    ))}
                  </div>
                </div>

                {/* Session & Thiết bị */}
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-1.5">
                    <Laptop size={14} className="text-slate-500" />
                    Phiên hoạt động ({sessionsData?.sessions?.length ?? 0})
                  </h4>
                  <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {sessionsData?.sessions?.[0]?.userAgent || 'Web Browser (NOAN Admin)'}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Đăng nhập: {relativeTime(sessionsData?.sessions?.[0]?.createdAt || userDetail.account.lastLoginAt)}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        if (!selectedUserId) return
                        await revokeSessions.mutateAsync(selectedUserId)
                        alert('Đã thu hồi toàn bộ phiên đăng nhập của nhân sự này.')
                      }}
                      className="h-7 text-[11px] text-rose-600 hover:text-rose-700"
                    >
                      Đăng xuất từ xa
                    </Button>
                  </div>
                </div>

                <DialogFooter className="pt-2">
                  <Button size="sm" variant="outline" onClick={() => setDetailOpen(false)}>
                    Đóng
                  </Button>
                </DialogFooter>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </PageContainer>
  )
}
