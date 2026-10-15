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
} from 'lucide-react'
import { useAuth } from '../../providers/AuthProvider'
import { useDashboardActivities } from '../../hooks/useDashboard'
import { useFoodScanReportSummary } from '../../hooks/useFoodScanReports'
import { Button } from '../ui/button'
import { Separator } from '../ui/separator'
import { Avatar, AvatarFallback } from '../ui/avatar'
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
  }

  return (
    <>
      <header className="modern-topbar">
        {/* Left: Breadcrumbs */}
        <div className="topbar-left">
          <nav className="breadcrumb-nav" aria-label="Breadcrumb">
            <button
              type="button"
              className="breadcrumb-home-btn"
              onClick={() => navigate('/dashboard')}
              title="Trang tổng quan"
            >
              <Home size={15} />
            </button>
            <span className="breadcrumb-sep"><ChevronRight size={13} /></span>
            <span className="breadcrumb-group">{currentGroupTitle}</span>
            <span className="breadcrumb-sep"><ChevronRight size={13} /></span>
            <span className="breadcrumb-current-pill">{currentNavLabel}</span>
          </nav>
        </div>

        {/* Center: Command Palette Trigger */}
        <div className="topbar-center">
          <button
            type="button"
            className="command-search-btn"
            onClick={() => setCommandOpen(true)}
            title="Tìm kiếm nhanh (Ctrl+K / ⌘K)"
          >
            <div className="command-search-left">
              <Search size={15} />
              <span>Tìm kiếm nhanh trang, tính năng...</span>
            </div>
            <kbd className="command-kbd">⌘ K</kbd>
          </button>
        </div>

        {/* Right: Actions & Profile */}
        <div className="topbar-right">
          {/* Quick Create Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="quick-create-btn">
                <Plus size={15} />
                <span>Tạo mới</span>
                <ChevronDown size={13} className="opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1.5 shadow-xl rounded-xl">
              <DropdownMenuLabel className="text-[10.5px] font-bold text-slate-400 px-3 py-1 uppercase tracking-wider">
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
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem
                onClick={() => navigate('/ingest')}
                className="gap-2.5 py-2 px-3 cursor-pointer rounded-lg text-xs font-medium"
              >
                <CloudDownload size={15} className="text-indigo-500" />
                <span>Nhập món tự động (AI)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notification Bell */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="topbar-icon-btn relative"
                title="Thông báo hệ thống"
              >
                <Bell size={16} />
                {scanMissingCount > 0 && <span className="notif-ping-dot" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0 shadow-xl overflow-hidden rounded-xl border border-border">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-slate-50/50">
                <span className="text-xs font-bold text-slate-800">Hoạt động gần đây</span>
                <span className="text-[11px] font-medium text-amber-600">
                  Mogu Cloud
                </span>
              </div>
              <div className="p-1 space-y-1 max-h-72 overflow-y-auto">
                {scanMissingCount > 0 && (
                  <DropdownMenuItem
                    className="mx-1 px-3 py-2 text-xs rounded-md cursor-pointer bg-rose-50 hover:bg-rose-100 transition-colors flex flex-col items-start gap-0.5"
                    onClick={() => navigate('/food-scan-reports')}
                  >
                    <div className="font-semibold text-rose-800 flex items-center gap-1.5">
                      <ScanSearch size={13} className="flex-shrink-0" />
                      {scanMissingCount} món quét chưa có trong kho
                    </div>
                    <p className="text-[11px] text-rose-700/80">
                      Người dùng đã chụp các món Mogu chưa có. Bấm để bổ sung.
                    </p>
                  </DropdownMenuItem>
                )}
                {isActLoading ? (
                  <div className="px-3 py-3 text-xs text-slate-500 text-center">Đang tải hoạt động...</div>
                ) : !activities || activities.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-slate-500 text-center">Chưa có hoạt động mới</div>
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
                        className="px-3 py-2 text-xs hover:bg-slate-50 rounded-md cursor-pointer transition-colors flex flex-col items-start gap-0.5"
                        onClick={() => {
                          if (act.type === 'DISH_REVIEW') navigate('/review')
                          else if (act.type === 'MODERATION') navigate('/community')
                          else if (act.type === 'IMPORT_JOB') navigate('/ingest')
                          else if (act.type === 'FOOD_SCAN_MISSING') navigate('/food-scan-reports')
                          else if (act.route) navigate(act.route)
                        }}
                      >
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5 truncate w-full">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
                          <span className="truncate">{act.title}</span>
                        </div>
                        {act.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-2">{act.description}</p>
                        )}
                        <span className="text-[10px] text-slate-400 mt-0.5 block">
                          {new Date(act.occurredAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </DropdownMenuItem>
                    )
                  })
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="h-5 mx-0.5" />

          {/* User Profile Trigger & Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="topbar-profile-trigger">
                <Avatar className="h-7 w-7 text-xs font-bold border border-border">
                  <AvatarFallback className="bg-amber-500/15 text-amber-700 font-bold">{initial}</AvatarFallback>
                </Avatar>
                <div className="topbar-user-meta">
                  <span className="topbar-user-name">{displayName}</span>
                  <span className="topbar-user-role">{roleLabel()}</span>
                </div>
                <ChevronDown size={13} className="text-slate-400 ml-0.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1.5 shadow-xl rounded-xl">
              <div className="flex items-center gap-2.5 px-3 py-2 border-b border-border/60 mb-1">
                <Avatar className="h-8 w-8 text-xs font-bold border border-border">
                  <AvatarFallback className="bg-amber-500/15 text-amber-700 font-bold">{initial}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-slate-800 truncate">{displayName}</span>
                  <span className="text-[10.5px] text-slate-500 truncate">{roleLabel()} • Mogu Cloud</span>
                </div>
              </div>

              <DropdownMenuItem
                onClick={() => navigate('/dashboard')}
                className="gap-2.5 py-2 px-3 cursor-pointer rounded-lg text-xs font-medium"
              >
                <Home size={15} className="text-slate-500" />
                <span>Bảng điều khiển</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate('/review')}
                className="gap-2.5 py-2 px-3 cursor-pointer rounded-lg text-xs font-medium"
              >
                <ShieldCheck size={15} className="text-slate-500" />
                <span>Hàng đợi kiểm duyệt</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1" />

              <DropdownMenuItem
                onClick={signOut}
                className="gap-2.5 py-2 px-3 cursor-pointer rounded-lg text-xs font-medium text-rose-600 focus:text-rose-700 focus:bg-rose-50"
              >
                <LogOut size={15} />
                <span>Đăng xuất</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Command Palette Modal */}
      <CommandPaletteModal open={commandOpen} onOpenChange={setCommandOpen} />
    </>
  )
}
