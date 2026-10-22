import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  Moon,
  Plus,
  ScanSearch,
  Search,
  Sun,
  UserCog,
} from 'lucide-react'
import { useAuth } from '../../providers/AuthProvider'
import { useDashboardActivities } from '../../hooks/useDashboard'
import { useFoodScanReportSummary } from '../../hooks/useFoodScanReports'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { cn } from '../../lib/utils'
import { resolveNav } from './nav-config'
import { useShell } from './shell-context'

function useTheme() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem('noan_theme', isDark ? 'dark' : 'light')
  }, [isDark])

  const toggle = () => {
    const apply = () => {
      document.documentElement.classList.add('theme-transition')
      setIsDark((prev) => !prev)
      window.setTimeout(() => document.documentElement.classList.remove('theme-transition'), 300)
    }
    const doc = document as Document & { startViewTransition?: (cb: () => void) => void }
    if (doc.startViewTransition) doc.startViewTransition(apply)
    else apply()
  }

  return { isDark, toggle }
}

function roleLabel(roles: string[]) {
  if (roles.includes('SUPER_ADMIN')) return 'Super Admin'
  if (roles.includes('CONTENT_ADMIN')) return 'Content Admin'
  if (roles.includes('REVIEWER')) return 'Reviewer'
  return 'Quản trị viên'
}

function Breadcrumb() {
  const { pathname } = useLocation()
  const resolved = resolveNav(pathname)

  let leaf = resolved?.item.label ?? 'Bảng điều khiển'
  let parent: { label: string; to: string } | null = null

  if (pathname === '/foods/new') {
    parent = { label: 'Kho món ăn', to: '/foods' }
    leaf = 'Thêm món mới'
  } else if (pathname.startsWith('/foods/')) {
    parent = { label: 'Kho món ăn', to: '/foods' }
    leaf = 'Chỉnh sửa món'
  }

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
      {resolved && (
        <span className="hidden shrink-0 text-muted-foreground sm:inline">{resolved.group.title}</span>
      )}
      {resolved && <ChevronRight size={14} className="hidden shrink-0 text-slate-300 dark:text-slate-600 sm:block" />}
      {parent && (
        <>
          <Link to={parent.to} className="hidden shrink-0 text-muted-foreground hover:text-foreground sm:inline">
            {parent.label}
          </Link>
          <ChevronRight size={14} className="hidden shrink-0 text-slate-300 dark:text-slate-600 sm:block" />
        </>
      )}
      <span className="truncate font-semibold text-foreground">{leaf}</span>
    </nav>
  )
}

const iconBtn =
  'relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-accent hover:text-foreground dark:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

export function Header() {
  const { user, roles, signOut, hasRole } = useAuth()
  const navigate = useNavigate()
  const { setMobileOpen, setCommandOpen } = useShell()
  const { isDark, toggle } = useTheme()

  const displayName = user?.displayName ?? 'Admin'
  const initial = displayName[0]?.toUpperCase() ?? 'A'

  const { data: activitiesData, isLoading: actLoading } = useDashboardActivities(6)
  const activities = activitiesData?.items ?? []
  const { data: scanSummary } = useFoodScanReportSummary()
  const scanMissing = scanSummary?.new ?? 0
  const canCreate = hasRole('SUPER_ADMIN', 'CONTENT_ADMIN')

  return (
    <header className="sticky top-0 z-20 flex h-[var(--header-h)] items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 sm:px-6">
      {/* Mobile menu */}
      <button
        type="button"
        className={cn(iconBtn, 'lg:hidden -ml-1')}
        onClick={() => setMobileOpen(true)}
        aria-label="Mở menu"
      >
        <Menu size={19} />
      </button>

      <div className="min-w-0 flex-1">
        <Breadcrumb />
      </div>

      {/* Search trigger */}
      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className="hidden h-9 w-64 items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm text-muted-foreground shadow-2xs transition-colors hover:border-slate-300 hover:text-foreground dark:hover:border-slate-600 md:flex xl:w-72"
        aria-label="Tìm kiếm nhanh"
      >
        <Search size={15} className="shrink-0" />
        <span className="flex-1 truncate text-left">Tìm trang, chức năng…</span>
        <kbd className="hidden shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-semibold text-muted-foreground lg:inline">
          Ctrl K
        </kbd>
      </button>
      <button type="button" className={cn(iconBtn, 'md:hidden')} onClick={() => setCommandOpen(true)} aria-label="Tìm kiếm">
        <Search size={18} />
      </button>

      <div className="flex shrink-0 items-center gap-1">
        {canCreate && (
          <button
            type="button"
            onClick={() => navigate('/foods/new')}
            className="mr-1 hidden h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-brand-600 sm:inline-flex"
          >
            <Plus size={16} />
            <span className="hidden xl:inline">Thêm món</span>
          </button>
        )}

        <button
          type="button"
          onClick={toggle}
          className={iconBtn}
          title={isDark ? 'Giao diện sáng' : 'Giao diện tối'}
          aria-label="Đổi giao diện sáng/tối"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={iconBtn} aria-label="Thông báo">
              <Bell size={18} />
              {scanMissing > 0 && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-background" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[340px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-border bg-popover p-0 shadow-pop">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold">Hoạt động gần đây</span>
              <Link to="/dashboard" className="text-xs font-medium text-primary hover:underline">
                Xem tất cả
              </Link>
            </div>
            <div className="max-h-[360px] overflow-y-auto p-1.5">
              {scanMissing > 0 && (
                <DropdownMenuItem
                  onClick={() => navigate('/food-scan-reports')}
                  className="mb-1 flex cursor-pointer items-start gap-3 rounded-lg bg-rose-50 px-3 py-2.5 hover:bg-rose-100/70 dark:bg-rose-500/10 dark:hover:bg-rose-500/15"
                >
                  <ScanSearch size={16} className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-rose-900 dark:text-rose-200">
                      {scanMissing} món quét chưa có trong kho
                    </p>
                    <p className="text-xs text-rose-700/80 dark:text-rose-300/80">Bấm để xem và bổ sung món</p>
                  </div>
                </DropdownMenuItem>
              )}
              {actLoading ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">Đang tải…</p>
              ) : activities.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">Chưa có hoạt động mới</p>
              ) : (
                activities.map((act) => {
                  const dot =
                    act.type === 'DISH_REVIEW'
                      ? 'bg-brand-500'
                      : act.type === 'MODERATION' || act.type === 'FOOD_SCAN_MISSING'
                        ? 'bg-rose-500'
                        : act.type === 'IMPORT_JOB'
                          ? 'bg-sky-500'
                          : 'bg-emerald-500'
                  const route =
                    act.type === 'DISH_REVIEW'
                      ? '/review'
                      : act.type === 'MODERATION'
                        ? '/community'
                        : act.type === 'IMPORT_JOB'
                          ? '/ingest'
                          : act.type === 'FOOD_SCAN_MISSING'
                            ? '/food-scan-reports'
                            : act.route
                  return (
                    <DropdownMenuItem
                      key={act.id}
                      onClick={() => route && navigate(route)}
                      className="flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-accent"
                    >
                      <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', dot)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-foreground">{act.title}</p>
                        {act.description && (
                          <p className="line-clamp-2 text-xs text-muted-foreground">{act.description}</p>
                        )}
                      </div>
                      <time className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {new Date(act.occurredAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </time>
                    </DropdownMenuItem>
                  )
                })
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ml-1 flex items-center gap-2 rounded-lg p-1 pr-1.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label="Tài khoản"
            >
              <Avatar className="h-8 w-8 ring-1 ring-black/5 dark:ring-white/10">
                <AvatarImage src={user?.avatarUrl ?? undefined} alt={displayName} />
                <AvatarFallback className="bg-brand-500 text-xs font-bold text-white">{initial}</AvatarFallback>
              </Avatar>
              <div className="hidden min-w-0 text-left leading-tight xl:block">
                <div className="max-w-[140px] truncate text-[13px] font-semibold text-foreground">{displayName}</div>
                <div className="text-[11px] text-muted-foreground">{roleLabel(roles)}</div>
              </div>
              <ChevronDown size={14} className="hidden text-muted-foreground xl:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 rounded-xl border border-border bg-popover p-1.5 shadow-pop">
            <div className="mb-1 flex items-center gap-3 border-b border-border px-2.5 pb-3 pt-2">
              <Avatar className="h-10 w-10 ring-1 ring-black/5 dark:ring-white/10">
                <AvatarImage src={user?.avatarUrl ?? undefined} alt={displayName} />
                <AvatarFallback className="bg-brand-500 text-sm font-bold text-white">{initial}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                <p className="text-xs font-medium text-primary">{roleLabel(roles)}</p>
              </div>
            </div>
            {hasRole('SUPER_ADMIN') && (
              <DropdownMenuItem
                onClick={() => navigate('/admin-users')}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px]"
              >
                <UserCog size={16} className="text-muted-foreground" />
                Quản trị viên & phân quyền
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={toggle}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px]"
            >
              {isDark ? <Sun size={16} className="text-muted-foreground" /> : <Moon size={16} className="text-muted-foreground" />}
              {isDark ? 'Giao diện sáng' : 'Giao diện tối'}
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem
              onClick={signOut}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
            >
              <LogOut size={16} />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
