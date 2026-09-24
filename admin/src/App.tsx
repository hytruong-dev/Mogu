import { Suspense, lazy, useState, useEffect, useRef, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  Archive,
  Bell,
  BookOpen,
  ChevronDown,
  ChevronRight,
  CloudDownload,
  Command,
  FileText,
  Heart,
  Home,
  LayoutDashboard,
  Leaf,
  LogOut,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Utensils,
} from 'lucide-react'
import { AuthProvider, useAuth, type AdminRole } from './providers/AuthProvider'
import { Button } from './components/ui/button'
import { Badge } from './components/ui/badge'
import { Separator } from './components/ui/separator'
import { Dialog, DialogContent } from './components/ui/dialog'
import { PageSkeleton } from './components/ui/page-skeleton'
import { useReviewQueue } from './hooks/useReviewQueue'
import { useDashboardActivities } from './hooks/useDashboard'
import './App.css'

// ─── Lazy pages ───────────────────────────────────────────────────────────────

const LoginPage = lazy(() => import('./pages/LoginPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const FoodsPage = lazy(() => import('./pages/FoodsPage'))
const CreateDishPage = lazy(() => import('./pages/CreateDishPage'))
const IngestPage = lazy(() => import('./pages/IngestPage'))
const ReviewPage = lazy(() => import('./pages/ReviewPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const CommunityPage = lazy(() => import('./pages/CommunityPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const FoodDataPage = lazy(() => import('./pages/FoodDataPage'))
const TopicsPage = lazy(() => import('./pages/TopicsPage'))
const ArticlesPage = lazy(() => import('./pages/ArticlesPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const PlacesPage = lazy(() => import('./pages/PlacesPage'))

// ─── React Query client ───────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

// ─── Nav config theo nhóm với RBAC ──────────────────────────────────────────

type NavItem = {
  path: string
  label: string
  icon: typeof LayoutDashboard
  badge?: string
  roles?: AdminRole[]
}

type NavGroup = {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: 'TỔNG QUAN',
    items: [
      { path: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    ],
  },
  {
    title: 'KHO MÓN & DINH DƯỠNG',
    items: [
      { path: '/foods', label: 'Kho món ăn', icon: Utensils, roles: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'REVIEWER'] },
      { path: '/food-data', label: 'Dữ liệu món ăn', icon: Leaf, roles: ['SUPER_ADMIN', 'CONTENT_ADMIN'] },
      { path: '/ingest', label: 'Nhập món tự động', icon: CloudDownload, roles: ['SUPER_ADMIN', 'CONTENT_ADMIN'] },
    ],
  },
  {
    title: 'KHÁM PHÁ & BÀI VIẾT',
    items: [
      { path: '/topics', label: 'Chủ đề', icon: BookOpen, roles: ['SUPER_ADMIN', 'CONTENT_ADMIN'] },
      { path: '/articles', label: 'Bài viết', icon: FileText, roles: ['SUPER_ADMIN', 'CONTENT_ADMIN'] },
      { path: '/places', label: 'Địa điểm quán ăn', icon: MapPin, roles: ['SUPER_ADMIN', 'CONTENT_ADMIN'] },
    ],
  },
  {
    title: 'VẬN HÀNH & KIỂM DUYỆT',
    items: [
      { path: '/review', label: 'Hàng đợi duyệt', icon: ShieldCheck, roles: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'REVIEWER'] },
      { path: '/community', label: 'Cộng đồng', icon: Heart, badge: 'Mới', roles: ['SUPER_ADMIN', 'CONTENT_ADMIN'] },
      { path: '/notifications', label: 'Phát thông báo', icon: Bell, roles: ['SUPER_ADMIN', 'CONTENT_ADMIN'] },
      { path: '/reports', label: 'Báo cáo vi phạm', icon: Archive, roles: ['SUPER_ADMIN'] },
    ],
  },
  {
    title: 'HỆ THỐNG',
    items: [
      { path: '/users', label: 'Người dùng', icon: Users, roles: ['SUPER_ADMIN'] },
    ],
  },
]

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function Sidebar({ currentPath }: { currentPath: string }) {
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const { data: queueData } = useReviewQueue()
  const queueCount = queueData?.total ?? queueData?.data?.length ?? 0

  return (
    <aside className="modern-sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand-container">
        <div className="sidebar-brand-logo">
          <div className="brand-icon-wrapper">
            <Sparkles size={18} className="text-zinc-950 fill-zinc-950" />
          </div>
          <div className="brand-text-block">
            <div className="brand-title-row">
              <span className="brand-title">Mogu</span>
              <span className="brand-badge">PRO</span>
            </div>
            <span className="brand-subtitle">Studio Console</span>
          </div>
        </div>
      </div>

      {/* Navigation Groups */}
      <nav className="sidebar-nav-scroll">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((item) => !item.roles || hasRole(...item.roles))
          if (visibleItems.length === 0) return null

          return (
            <div key={group.title} className="sidebar-group">
              <span className="sidebar-group-title">{group.title}</span>
              <div className="sidebar-group-items">
                {visibleItems.map(({ path, label, icon: Icon, badge }) => {
                  const isActive = currentPath === path || (path !== '/' && currentPath.startsWith(path))
                  const itemBadge = path === '/review' ? (queueCount > 0 ? String(queueCount) : undefined) : badge
                  return (
                    <button
                      key={path}
                      className={`sidebar-nav-button ${isActive ? 'is-active' : ''}`}
                      onClick={() => navigate(path)}
                    >
                      <Icon size={17} strokeWidth={isActive ? 2.1 : 1.8} />
                      <span className="nav-label">{label}</span>
                      {itemBadge && (
                        <span className="nav-badge-pill">{itemBadge}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="sidebar-footer-container">
        <div className="system-status-indicator">
          <span className="status-pulse-dot" />
          <div className="system-status-text">
            <span>Hệ thống ổn định</span>
            <small>v1.2.0 • Mogu Cloud</small>
          </div>
        </div>

        <div className="sidebar-cmd-hint">
          <span>Tìm kiếm nhanh</span>
          <kbd>⌘K</kbd>
        </div>
      </div>
    </aside>
  )
}

// ─── Command Palette Modal ───────────────────────────────────────────────────

function CommandPaletteModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  const quickNavItems = [
    { path: '/dashboard', label: 'Tổng quan điều hành', category: 'TỔNG QUAN', icon: LayoutDashboard, desc: 'Chỉ số thống kê, biểu đồ hoạt động và nhiệm vụ' },
    { path: '/foods', label: 'Kho món ăn', category: 'KHO MÓN & DINH DƯỠNG', icon: Utensils, desc: 'Quản lý toàn bộ danh sách món ăn, calo và dinh dưỡng' },
    { path: '/foods/new', label: 'Thêm món ăn mới', category: 'KHO MÓN & DINH DƯỠNG', icon: Plus, desc: 'Nhập công thức, nguyên liệu và macro món ăn' },
    { path: '/food-data', label: 'Dữ liệu món ăn', category: 'KHO MÓN & DINH DƯỠNG', icon: Leaf, desc: 'Quản lý nguyên liệu, danh mục và taxonomy ẩm thực' },
    { path: '/ingest', label: 'Nhập món tự động (AI)', category: 'KHO MÓN & DINH DƯỠNG', icon: CloudDownload, desc: 'Crawl dữ liệu, trích xuất AI và kiểm duyệt hàng loạt' },
    { path: '/topics', label: 'Quản lý chủ đề', category: 'KHÁM PHÁ & BÀI VIẾT', icon: BookOpen, desc: 'Các chuyên mục khám phá ẩm thực theo mùa và chủ đề' },
    { path: '/articles', label: 'Quản lý bài viết', category: 'KHÁM PHÁ & BÀI VIẾT', icon: FileText, desc: 'Soạn thảo, biên tập và xuất bản bài viết ẩm thực' },
    { path: '/review', label: 'Hàng đợi kiểm duyệt', category: 'VẬN HÀNH & KIỂM DUYỆT', icon: ShieldCheck, desc: 'Duyệt công thức, nguyên liệu và đánh giá người dùng' },
    { path: '/community', label: 'Kiểm duyệt cộng đồng', category: 'VẬN HÀNH & KIỂM DUYỆT', icon: Heart, desc: 'Kiểm tra bài đăng, bình luận và tương tác thành viên' },
    { path: '/reports', label: 'Báo cáo & Phân tích', category: 'VẬN HÀNH & KIỂM DUYỆT', icon: Archive, desc: 'Thống kê vi phạm, phản hồi người dùng và số liệu' },
    { path: '/users', label: 'Quản lý người dùng', category: 'HỆ THỐNG', icon: Users, desc: 'Danh sách tài khoản, phân quyền Super Admin/Content Admin' },
  ]

  const filtered = quickNavItems.filter((item) => {
    const q = search.toLowerCase().trim()
    if (!q) return true
    return (
      item.label.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.desc.toLowerCase().includes(q) ||
      item.path.toLowerCase().includes(q)
    )
  })

  // Reset search when modal closes
  useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden rounded-xl border border-border shadow-2xl bg-white">
        <div className="flex items-center px-4 border-b border-border/70 h-13">
          <Search size={17} className="text-slate-400 mr-3 flex-shrink-0" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm trang, chức năng hoặc thao tác nhanh..."
            className="w-full bg-transparent border-none outline-none text-sm text-slate-800 placeholder:text-slate-400 h-12"
          />
          <Badge variant="outline" className="text-[10px] font-bold text-slate-400 border-slate-200">
            ESC
          </Badge>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              Không tìm thấy kết quả phù hợp cho "{search}"
            </div>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    onOpenChange(false)
                    navigate(item.path)
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg text-left hover:bg-amber-500/10 transition-colors group cursor-pointer border-none bg-transparent"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-amber-500/20 group-hover:text-amber-700 transition-colors flex-shrink-0">
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 group-hover:text-amber-950 truncate">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">{item.desc}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-amber-700 flex-shrink-0 ml-2">
                    {item.category.split(' ')[0]}
                  </span>
                </button>
              )
            })
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-t border-border/70 text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span>↑↓ để xem</span>
            <span>•</span>
            <span>↵ để mở trang</span>
          </div>
          <div className="flex items-center gap-1 font-medium text-slate-400">
            Mogu Cloud Studio
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Header ──────────────────────────────────────────────────────────────────

function Header() {
  const { user, roles, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const displayName = user?.displayName ?? 'Admin'
  const initial = displayName[0]?.toUpperCase() ?? 'A'

  const [commandOpen, setCommandOpen] = useState(false)
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const [notifMenuOpen, setNotifMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const createMenuRef = useRef<HTMLDivElement>(null)
  const notifMenuRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)

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

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (createMenuRef.current && !createMenuRef.current.contains(target)) {
        setCreateMenuOpen(false)
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(target)) {
        setNotifMenuOpen(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const roleLabel = () => {
    if (roles.includes('SUPER_ADMIN')) return 'Super Admin'
    if (roles.includes('CONTENT_ADMIN')) return 'Content Admin'
    if (roles.includes('REVIEWER')) return 'Reviewer'
    return 'Quản trị viên'
  }

  const { data: activitiesData, isLoading: isActLoading } = useDashboardActivities(6)
  const activities = activitiesData?.items ?? []

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
          <div className="relative" ref={createMenuRef}>
            <Button
              size="sm"
              className="quick-create-btn"
              onClick={() => {
                setCreateMenuOpen((v) => !v)
                setNotifMenuOpen(false)
                setUserMenuOpen(false)
              }}
            >
              <Plus size={15} />
              <span>Tạo mới</span>
              <ChevronDown size={13} className="opacity-70" />
            </Button>

            {createMenuOpen && (
              <div className="nav-dropdown-menu">
                <div className="text-[10.5px] font-bold text-slate-400 px-3 py-1 uppercase tracking-wider">
                  Tạo nội dung mới
                </div>
                <button
                  className="dropdown-item-btn"
                  onClick={() => {
                    setCreateMenuOpen(false)
                    navigate('/foods/new')
                  }}
                >
                  <Utensils size={15} className="text-amber-500" />
                  <span>Thêm món ăn mới</span>
                </button>
                <button
                  className="dropdown-item-btn"
                  onClick={() => {
                    setCreateMenuOpen(false)
                    navigate('/articles')
                  }}
                >
                  <FileText size={15} className="text-blue-500" />
                  <span>Soạn bài viết mới</span>
                </button>
                <button
                  className="dropdown-item-btn"
                  onClick={() => {
                    setCreateMenuOpen(false)
                    navigate('/topics')
                  }}
                >
                  <BookOpen size={15} className="text-emerald-500" />
                  <span>Tạo chủ đề mới</span>
                </button>
                <Separator className="my-1" />
                <button
                  className="dropdown-item-btn"
                  onClick={() => {
                    setCreateMenuOpen(false)
                    navigate('/ingest')
                  }}
                >
                  <CloudDownload size={15} className="text-indigo-500" />
                  <span>Nhập món tự động (AI)</span>
                </button>
              </div>
            )}
          </div>

          {/* Notification Bell */}
          <div className="relative" ref={notifMenuRef}>
            <button
              className={`topbar-icon-btn ${notifMenuOpen ? 'is-active' : ''}`}
              onClick={() => {
                setNotifMenuOpen((v) => !v)
                setCreateMenuOpen(false)
                setUserMenuOpen(false)
              }}
              title="Thông báo hệ thống"
            >
              <Bell size={16} />
              <span className="notif-ping-dot" />
            </button>

            {notifMenuOpen && (
              <div className="nav-dropdown-menu notif-dropdown-menu">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
                  <span className="text-xs font-bold text-slate-800">Hoạt động gần đây</span>
                  <span
                    className="text-[11px] font-medium text-amber-600 cursor-pointer hover:underline"
                    onClick={() => setNotifMenuOpen(false)}
                  >
                    Đóng
                  </span>
                </div>
                <div className="py-1 space-y-1 max-h-72 overflow-y-auto">
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
                              : 'bg-emerald-500'
                      return (
                        <div
                          key={act.id}
                          className="px-3 py-2 text-xs hover:bg-slate-50 rounded-md cursor-pointer transition-colors"
                          onClick={() => {
                            setNotifMenuOpen(false)
                            if (act.type === 'DISH_REVIEW') navigate('/review')
                            else if (act.type === 'MODERATION') navigate('/community')
                            else if (act.type === 'IMPORT_JOB') navigate('/ingest')
                          }}
                        >
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5 truncate">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
                            <span className="truncate">{act.title}</span>
                          </div>
                          {act.description && (
                            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{act.description}</p>
                          )}
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            {new Date(act.occurredAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <Separator orientation="vertical" className="h-5 mx-0.5" />

          {/* User Profile Trigger & Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              className={`topbar-profile-trigger ${userMenuOpen ? 'is-open' : ''}`}
              onClick={() => {
                setUserMenuOpen((v) => !v)
                setCreateMenuOpen(false)
                setNotifMenuOpen(false)
              }}
            >
              <div className="topbar-avatar">{initial}</div>
              <div className="topbar-user-meta">
                <span className="topbar-user-name">{displayName}</span>
                <span className="topbar-user-role">{roleLabel()}</span>
              </div>
              <ChevronDown size={13} className="text-slate-400 ml-0.5" />
            </button>

            {userMenuOpen && (
              <div className="nav-dropdown-menu">
                <div className="dropdown-user-header">
                  <div className="topbar-avatar">{initial}</div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-slate-800 truncate">{displayName}</span>
                    <span className="text-[10.5px] text-slate-500 truncate">{roleLabel()} • Mogu Cloud</span>
                  </div>
                </div>

                <button
                  className="dropdown-item-btn"
                  onClick={() => {
                    setUserMenuOpen(false)
                    navigate('/dashboard')
                  }}
                >
                  <LayoutDashboard size={14} className="text-slate-500" />
                  <span>Bảng điều khiển</span>
                </button>

                <button
                  className="dropdown-item-btn"
                  onClick={() => {
                    setUserMenuOpen(false)
                    navigate('/users')
                  }}
                >
                  <Users size={14} className="text-slate-500" />
                  <span>Quản lý người dùng</span>
                </button>

                <button
                  className="dropdown-item-btn"
                  onClick={() => {
                    setUserMenuOpen(false)
                    setCommandOpen(true)
                  }}
                >
                  <Command size={14} className="text-slate-500" />
                  <span>Lối tắt bàn phím (⌘K)</span>
                </button>

                <Separator className="my-1" />

                <button
                  className="dropdown-item-btn danger"
                  onClick={() => {
                    setUserMenuOpen(false)
                    signOut()
                  }}
                >
                  <LogOut size={14} />
                  <span>Đăng xuất</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Command Palette Modal */}
      <CommandPaletteModal
        open={commandOpen}
        onOpenChange={setCommandOpen}
      />
    </>
  )
}

// ─── Protected Layout ─────────────────────────────────────────────────────────

function ProtectedLayout({ children, currentPath }: { children: ReactNode; currentPath: string }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 16, color: 'var(--text-muted)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 8 }}>⏳</div>
          Đang kiểm tra phiên đăng nhập...
        </div>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  return (
    <div className="app-shell">
      <Sidebar currentPath={currentPath} />
      <main>
        <Header />
        <div className="content">{children}</div>
      </main>
    </div>
  )
}

// ─── Public Route ─────────────────────────────────────────────────────────────

function PublicRoute() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg, #faf8f3)' }}>
        <PageSkeleton rows={5} withAvatar className="max-w-md mx-auto pt-24" />
      </div>
    )
  }

  if (session) return <Navigate to="/dashboard" replace />
  return <LoginPage />
}

// ─── App routes ───────────────────────────────────────────────────────────────

function AppRoutes() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '60vh', padding: 24 }}>
          <PageSkeleton rows={6} />
        </div>
      }
    >
      <Routes>
        <Route path="/login" element={<PublicRoute />} />

        <Route path="/dashboard" element={<ProtectedLayout currentPath="/dashboard"><DashboardPage /></ProtectedLayout>} />
        <Route path="/foods" element={<ProtectedLayout currentPath="/foods"><FoodsPage /></ProtectedLayout>} />
        <Route path="/foods/new" element={<ProtectedLayout currentPath="/foods"><CreateDishPage key="dish-new" /></ProtectedLayout>} />
        <Route path="/foods/:id" element={<ProtectedLayout currentPath="/foods"><CreateDishPage key="dish-edit" /></ProtectedLayout>} />
        <Route path="/ingest" element={<ProtectedLayout currentPath="/ingest"><IngestPage /></ProtectedLayout>} />
        <Route path="/review" element={<ProtectedLayout currentPath="/review"><ReviewPage /></ProtectedLayout>} />
        <Route path="/users" element={<ProtectedLayout currentPath="/users"><UsersPage /></ProtectedLayout>} />
        <Route path="/community" element={<ProtectedLayout currentPath="/community"><CommunityPage /></ProtectedLayout>} />
        <Route path="/reports" element={<ProtectedLayout currentPath="/reports"><ReportsPage /></ProtectedLayout>} />
        <Route path="/food-data" element={<ProtectedLayout currentPath="/food-data"><FoodDataPage /></ProtectedLayout>} />
        <Route path="/ingredients" element={<Navigate to="/food-data?tab=ingredients" replace />} />
        <Route path="/categories" element={<Navigate to="/food-data?tab=categories" replace />} />
        <Route path="/diet-types" element={<Navigate to="/food-data?tab=diet-types" replace />} />
        <Route path="/allergens" element={<Navigate to="/food-data?tab=allergens" replace />} />
        <Route path="/topics" element={<ProtectedLayout currentPath="/topics"><TopicsPage /></ProtectedLayout>} />
        <Route path="/articles" element={<ProtectedLayout currentPath="/articles"><ArticlesPage /></ProtectedLayout>} />
        <Route path="/places" element={<ProtectedLayout currentPath="/places"><PlacesPage /></ProtectedLayout>} />
        <Route path="/notifications" element={<ProtectedLayout currentPath="/notifications"><NotificationsPage /></ProtectedLayout>} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
