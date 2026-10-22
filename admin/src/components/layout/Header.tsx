import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Bell,
  BookOpen,
  ChevronDown,
  ChevronRight,
  CloudDownload,
  FileText,
  Home,
  LogOut,
  Plus,
  ScanSearch,
  Search,
  ShieldCheck,
  Utensils,
  Command,
  Sun,
  Moon,
} from 'lucide-react'
import { useAuth } from '../../providers/AuthProvider'
import { useDashboardActivities } from '../../hooks/useDashboard'
import { useFoodScanReportSummary } from '../../hooks/useFoodScanReports'
import { Button } from '../ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '../ui/dropdown-menu'
import { navGroups } from './nav-config'
import { CommandPaletteModal } from './CommandPaletteModal'

export function Header() {
  const { user, roles, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const displayName = user?.displayName ?? 'Admin'
  const initial = displayName[0]?.toUpperCase() ?? 'A'

  const [commandOpen, setCommandOpen] = useState(false)
  const [isDark, setIsDark] = useState(() => {
    return (
      localStorage.getItem('noan_theme') === 'dark' ||
      (!('noan_theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
    )
  })

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('noan_theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('noan_theme', 'light')
    }
  }, [isDark])

  const toggleTheme = () => {
    const applyToggle = () => {
      document.documentElement.classList.add('theme-transition')
      setIsDark((prev) => !prev)
      setTimeout(() => {
        document.documentElement.classList.remove('theme-transition')
      }, 350)
    }

    if ('startViewTransition' in document) {
      (document as any).startViewTransition(applyToggle)
    } else {
      applyToggle()
    }
  }

  // Listen for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const roleLabel = () => {
    if (roles.includes('SUPER_ADMIN')) return 'Super Admin'
    if (roles.includes('CONTENT_ADMIN')) return 'Content Admin'
    if (roles.includes('REVIEWER')) return 'Reviewer'
    return 'Quản trị viên'
  }

  const { data: activitiesData, isLoading: isActLoading } = useDashboardActivities(6)
  const activities = activitiesData?.items ?? []
  const { data: scanSummary } = useFoodScanReportSummary()
  const scanMissingCount = scanSummary?.new ?? 0

  // Resolve current active item and its group
  let currentGroupTitle = 'TỔNG QUAN'
  let currentNavLabel = 'Tổng quan'

  for (const group of navGroups) {
    for (const item of group.items) {
      if (location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path))) {
        currentGroupTitle = group.title
        currentNavLabel = item.label
        break
      }
    }
  }

  if (location.pathname === '/foods/new') {
    currentNavLabel = 'Thêm món ăn mới'
  } else if (location.pathname.startsWith('/foods/') && location.pathname !== '/foods') {
    currentNavLabel = 'Chỉnh sửa món ăn'
  }

  return (
    <>
      <header className="h-16 px-6 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between sticky top-0 z-30 transition-colors">
        {/* Left: Breadcrumbs */}
        <div className="flex items-center gap-2">
          <nav className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400" aria-label="Breadcrumb">
            <button
              type="button"
              className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
              onClick={() => navigate('/dashboard')}
              title="Trang tổng quan"
            >
              <Home size={15} />
            </button>
            <ChevronRight size={13} className="text-slate-300 dark:text-slate-600 shrink-0" />
            <span className="text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              {currentGroupTitle}
            </span>
            <ChevronRight size={13} className="text-slate-300 dark:text-slate-600 shrink-0" />
            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold text-xs">
              {currentNavLabel}
            </span>
          </nav>
        </div>

        {/* Center: Command Palette Trigger */}
        <div className="flex-1 max-w-md mx-6 hidden md:block">
          <button
            type="button"
            className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-lg border border-slate-200/90 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-400 dark:text-slate-500 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-white dark:hover:bg-slate-800 transition-all shadow-xs"
            onClick={() => setCommandOpen(true)}
            title="Tìm kiếm nhanh (Ctrl+K / ⌘K)"
          >
            <div className="flex items-center gap-2">
              <Search size={14} className="text-slate-400" />
              <span>Tìm kiếm nhanh trang, tính năng...</span>
            </div>
            <kbd className="inline-flex items-center gap-0.5 font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 shadow-2xs">
              <Command size={10} /> K
            </kbd>
          </button>
        </div>

        {/* Right: Actions & Profile */}
        <div className="flex items-center gap-3">
          {/* Quick Create Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white font-medium text-xs h-8 gap-1.5 px-3 rounded-lg shadow-xs shadow-amber-500/20">
                <Plus size={15} />
                <span className="hidden sm:inline">Tạo mới</span>
                <ChevronDown size={13} className="opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1.5 shadow-xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <DropdownMenuLabel className="text-[10.5px] font-bold text-slate-400 dark:text-slate-500 px-3 py-1 uppercase tracking-wider">
                Tạo nội dung mới
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => navigate('/foods/new')}
                className="gap-2.5 py-2 px-3 cursor-pointer rounded-lg text-xs font-medium"
              >
                <Utensils size={15} className="text-amber-500" />
                <span>Thêm món ăn mới</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate('/articles')}
                className="gap-2.5 py-2 px-3 cursor-pointer rounded-lg text-xs font-medium"
              >
                <FileText size={15} className="text-blue-500" />
                <span>Soạn bài viết mới</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate('/topics')}
                className="gap-2.5 py-2 px-3 cursor-pointer rounded-lg text-xs font-medium"
              >
                <BookOpen size={15} className="text-emerald-500" />
                <span>Tạo chủ đề mới</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1 border-slate-100 dark:border-slate-800" />
              <DropdownMenuItem
                onClick={() => navigate('/ingest')}
                className="gap-2.5 py-2 px-3 cursor-pointer rounded-lg text-xs font-medium"
              >
                <CloudDownload size={15} className="text-indigo-500" />
                <span>Nhập món tự động (AI)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            title={isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} />}
          </button>

          {/* Notification Bell */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="relative p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                title="Thông báo hệ thống"
              >
                <Bell size={17} />
                {scanMissingCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0 shadow-xl overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Hoạt động gần đây</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
                  Mogu Live
                </span>
              </div>
              <div className="p-1 space-y-1 max-h-72 overflow-y-auto">
                {scanMissingCount > 0 && (
                  <DropdownMenuItem
                    className="mx-1 px-3 py-2 text-xs rounded-lg cursor-pointer bg-rose-50/80 hover:bg-rose-100/80 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 transition-colors flex flex-col items-start gap-0.5"
                    onClick={() => navigate('/food-scan-reports')}
                  >
                    <div className="font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                      <ScanSearch size={13} className="shrink-0" />
                      {scanMissingCount} món quét chưa có trong kho
                    </div>
                    <p className="text-[11px] text-rose-600 dark:text-rose-400">
                      Người dùng đã chụp các món Mogu chưa có. Bấm để bổ sung.
                    </p>
                  </DropdownMenuItem>
                )}
                {isActLoading ? (
                  <div className="px-3 py-4 text-xs text-slate-400 text-center">Đang tải hoạt động...</div>
                ) : !activities || activities.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-slate-400 text-center">Chưa có hoạt động mới</div>
                ) : (
                  activities.map((act) => {
                    const dotColor =
                      act.type === 'DISH_REVIEW'
                        ? 'bg-amber-500'
                        : act.type === 'MODERATION'
                          ? 'bg-rose-500'
                          : act.type === 'IMPORT_JOB'
                            ? 'bg-blue-500'
                            : act.type === 'FOOD_SCAN_MISSING'
                              ? 'bg-rose-500'
                              : 'bg-emerald-500'
                    return (
                      <DropdownMenuItem
                        key={act.id}
                        className="px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-lg cursor-pointer transition-colors flex flex-col items-start gap-0.5"
                        onClick={() => {
                          if (act.type === 'DISH_REVIEW') navigate('/review')
                          else if (act.type === 'MODERATION') navigate('/community')
                          else if (act.type === 'IMPORT_JOB') navigate('/ingest')
                          else if (act.type === 'FOOD_SCAN_MISSING') navigate('/food-scan-reports')
                          else if (act.route) navigate(act.route)
                        }}
                      >
                        <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 truncate w-full">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                          <span className="truncate">{act.title}</span>
                        </div>
                        {act.description && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">{act.description}</p>
                        )}
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block">
                          {new Date(act.occurredAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </DropdownMenuItem>
                    )
                  })
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2.5 p-1 pl-1.5 pr-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-left group"
              >
                <Avatar className="w-8 h-8 rounded-full ring-2 ring-amber-500/40 overflow-hidden bg-amber-500 shadow-xs shrink-0">
                  <AvatarImage src={user?.avatarUrl ?? undefined} alt={displayName} className="object-cover w-full h-full" />
                  <AvatarFallback className="bg-amber-500 text-white font-bold text-xs">
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden lg:flex flex-col">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight group-hover:text-amber-600 transition-colors">
                    {displayName}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-none mt-0.5">
                    {roleLabel()}
                  </span>
                </div>
                <ChevronDown size={13} className="text-slate-400 group-hover:text-slate-600 transition-colors hidden sm:inline" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 p-1.5 shadow-xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-3 px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 mb-1">
                <Avatar className="w-10 h-10 rounded-full ring-2 ring-amber-500/40 overflow-hidden bg-amber-500 shadow-sm shrink-0">
                  <AvatarImage src={user?.avatarUrl ?? undefined} alt={displayName} className="object-cover w-full h-full" />
                  <AvatarFallback className="bg-amber-500 text-white font-bold text-xs">{initial}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{displayName}</p>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold truncate">{roleLabel()}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">ID: {user?.id.slice(0, 8) ?? 'admin'}</p>
                </div>
              </div>
              <DropdownMenuItem
                onClick={() => navigate('/users')}
                className="gap-2.5 py-2 px-3 cursor-pointer rounded-lg text-xs font-medium"
              >
                <ShieldCheck size={14} className="text-slate-500" />
                <span>Quản lý phân quyền</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1 border-slate-100 dark:border-slate-800" />
              <DropdownMenuItem
                onClick={signOut}
                className="gap-2.5 py-2 px-3 cursor-pointer rounded-lg text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <LogOut size={14} />
                <span>Đăng xuất</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Global Command Palette */}
      <CommandPaletteModal open={commandOpen} onOpenChange={setCommandOpen} />
    </>
  )
}
