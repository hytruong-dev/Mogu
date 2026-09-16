import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  MoreVertical,
  Search,
  ShieldCheck,
  Upload,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Skeleton } from '../components/ui/skeleton'
import { PageSkeleton, StatsSkeleton, TableSkeleton } from '../components/ui/page-skeleton'
import { Spinner } from '../components/ui/spinner'
import {
  useAdminUser,
  useAdminUserActions,
  useAdminUsers,
  useUsersSummary,
} from '../hooks/useUsers'
import type { AdminUserListItem } from '../api/users'

const avatarFallback = '/assets/avatar.jpg'

function formatNumber(n: number) {
  return new Intl.NumberFormat('vi-VN').format(n)
}

function relativeTime(iso: string | null) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'vừa xong'
  if (mins < 60) return `${mins} phút trước`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  return `${days} ngày trước`
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
  tone?: string
  loading?: boolean
}) {
  return (
    <Card className="stat-card">
      <div className={`metric-icon ${tone}`}>
        <Icon size={27} />
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

  return (
    <Card className="user-drawer">
      <header>
        <b>{data?.identity.displayName ?? 'Chi tiết người dùng'}</b>
        <button type="button" onClick={close} aria-label="Đóng">
          <X />
        </button>
      </header>

      {isLoading && <PageSkeleton rows={6} withAvatar className="p-4" />}

      {isError && (
        <div className="p-4">
          <p className="text-sm text-red-600 mb-2">
            {(error as Error)?.message ?? 'Không tải được chi tiết.'}
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Thử lại
          </Button>
        </div>
      )}

      {data && (
        <>
          <div className="drawer-profile">
            <img src={data.identity.avatarUrl || avatarFallback} alt="" />
            <span>
              <b>{data.identity.displayName ?? '—'}</b>
              <small>{data.identity.email}</small>
              <small>
                Tham gia:{' '}
                {new Date(data.account.createdAt).toLocaleDateString('vi-VN')}
              </small>
            </span>
          </div>
          {(
            [
              ['Username', data.identity.username ?? '—'],
              ['Mục tiêu', data.productSummary.primaryGoal?.name ?? '—'],
              ['Trạng thái tài khoản', statusLabel(data.account.status)],
              ['Vai trò', data.access.roles.join(', ') || 'USER'],
              ['Món đã lưu', `${data.productSummary.savedDishCount}`],
              ['Lượt random', `${data.productSummary.randomRunCount}`],
              ['Bài viết', `${data.productSummary.publishedPostCount}`],
              ['Phiên đang mở', `${data.access.activeSessionCount ?? 0}`],
            ] as [string, string][]
          ).map(([a, b]) => (
            <div className="drawer-item" key={a}>
              <span>{a}</span>
              <b>{b}</b>
            </div>
          ))}
          {data.activeRestriction != null && (
            <div className="drawer-item">
              <span>Hạn chế đang hiệu lực</span>
              <b>Có</b>
            </div>
          )}
          <footer className="flex flex-col gap-2">
            <Button
              variant="outline"
              disabled={actions.passwordReset.isPending}
              onClick={() => actions.passwordReset.mutate(userId)}
            >
              {actions.passwordReset.isPending ? <Spinner size="sm" /> : null}
              Gửi đặt lại mật khẩu
            </Button>
            <Button
              variant="outline"
              disabled={actions.verificationReminder.isPending}
              onClick={() => actions.verificationReminder.mutate(userId)}
            >
              Nhắc xác minh email
            </Button>
            {data.account.status === 'LOCKED' ? (
              <Button
                disabled={actions.unlock.isPending}
                onClick={() => actions.unlock.mutate(userId)}
              >
                Mở khóa bảo mật
              </Button>
            ) : (
              <Button
                variant="danger"
                disabled={actions.suspend.isPending || data.account.status === 'SUSPENDED'}
                onClick={() => {
                  if (confirm('Hạn chế tài khoản này?')) actions.suspend.mutate(userId)
                }}
              >
                Hạn chế tài khoản
              </Button>
            )}
          </footer>
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

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Người dùng</h1>
          <p>Quản lý tài khoản và quyền truy cập</p>
        </div>
      </div>
      {summary.isLoading ? (
        <StatsSkeleton />
      ) : (
        <div className="stats-grid">
          <Stat icon={Users} value={formatNumber(metrics.total)} label="người dùng" tone="yellow" />
          <Stat icon={Zap} value={formatNumber(metrics.active)} label="hoạt động hôm nay" tone="yellow" />
          <Stat icon={Users} value={formatNumber(metrics.neu)} label="tài khoản mới" tone="green" />
          <Stat icon={ShieldCheck} value={formatNumber(metrics.restricted)} label="bị hạn chế" tone="red" />
        </div>
      )}
      <div className={selectedId ? 'users-layout open' : 'users-layout'}>
        <Card className="table-card users-table">
          <div className="filters">
            <label>
              <Search size={18} />
              <Input
                placeholder="Tìm tên, username..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            <select
              className="border rounded-md px-3 py-2 text-sm bg-white"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Trạng thái</option>
              <option value="ACTIVE">Hoạt động</option>
              <option value="PENDING_VERIFICATION">Chờ xác minh</option>
              <option value="LOCKED">Đã khóa</option>
              <option value="SUSPENDED">Bị hạn chế</option>
            </select>
            <Button variant="outline" disabled>
              Mục tiêu
              <ChevronDown />
            </Button>
            <Button
              variant="outline"
              disabled={actions.createExport.isPending}
              onClick={() => actions.createExport.mutate()}
            >
              {actions.createExport.isPending ? <Spinner size="sm" /> : <Upload />} Xuất danh sách
            </Button>
          </div>

          {list.isLoading && <TableSkeleton rows={6} cols={5} />}

          {list.isError && (
            <div className="p-6">
              <p className="text-red-600 mb-2">Không tải được danh sách người dùng.</p>
              <Button variant="outline" onClick={() => list.refetch()}>
                Thử lại
              </Button>
            </div>
          )}

          {!list.isLoading && !list.isError && items.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              Không có người dùng phù hợp.
            </div>
          )}

          {!list.isLoading && !list.isError && items.length > 0 && (
            <>
              <table>
                <thead>
                  <tr>
                    <th>Người dùng</th>
                    <th>Mục tiêu</th>
                    <th>Trạng thái</th>
                    <th>Hoạt động gần nhất</th>
                    <th>Ngày tham gia</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((u) => (
                    <tr
                      key={u.userId}
                      className={selectedId === u.userId ? 'selected-row' : ''}
                      onClick={() => setSelectedId(u.userId)}
                    >
                      <td className="user-cell">
                        <img src={u.avatarUrl || avatarFallback} alt="" />
                        <span>
                          <b>{u.displayName ?? u.username ?? '—'}</b>
                          <small>{u.email}</small>
                        </span>
                      </td>
                      <td>{u.primaryGoal?.name ?? '—'}</td>
                      <td>
                        <Badge
                          className={
                            u.accountStatus === 'ACTIVE' ? 'published' : 'pending'
                          }
                        >
                          • {statusLabel(u.accountStatus)}
                        </Badge>
                      </td>
                      <td>{relativeTime(u.lastActiveAt)}</td>
                      <td>{new Date(u.joinedAt).toLocaleDateString('vi-VN')}</td>
                      <td>
                        <MoreVertical />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-between p-3">
                <Button
                  variant="outline"
                  disabled={cursorStack.length <= 1}
                  onClick={() => setCursorStack((s) => s.slice(0, -1))}
                >
                  Trang trước
                </Button>
                <Button
                  variant="outline"
                  disabled={!pageInfo?.nextCursor && !(pageInfo as any)?.hasNextPage}
                  onClick={() => {
                    if (pageInfo?.nextCursor) {
                      setCursorStack((s) => [...s, pageInfo.nextCursor])
                    }
                  }}
                >
                  Trang sau
                </Button>
              </div>
            </>
          )}
        </Card>
        {selectedId && (
          <UserDrawer userId={selectedId} close={() => setSelectedId(null)} />
        )}
      </div>
    </>
  )
}
