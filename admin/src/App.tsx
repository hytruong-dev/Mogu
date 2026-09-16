import { Suspense, lazy, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  Archive,
  Bell,
  BookOpen,
  ChevronDown,
  CloudDownload,
  FileText,
  Heart,
  LayoutDashboard,
  Leaf,
  Search,
  ShieldCheck,
  Users,
  Utensils,
} from 'lucide-react'
import { CheckCircle2 } from 'lucide-react'
import { AuthProvider, useAuth, type AdminRole } from './providers/AuthProvider'
import { Input } from './components/ui/input'
import { PageSkeleton } from './components/ui/page-skeleton'
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

// ─── Nav config với RBAC ─────────────────────────────────────────────────────

type NavItem = {
  path: string
  label: string
  icon: typeof LayoutDashboard
  // undefined = tất cả roles đều thấy
  roles?: AdminRole[]
}

const nav: NavItem[] = [
  { path: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { path: '/foods', label: 'Kho món ăn', icon: Utensils, roles: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'REVIEWER'] },
  { path: '/food-data', label: 'Dữ liệu món ăn', icon: Leaf, roles: ['SUPER_ADMIN', 'CONTENT_ADMIN'] },
  { path: '/ingest', label: 'Nhập món tự động', icon: CloudDownload, roles: ['SUPER_ADMIN', 'CONTENT_ADMIN'] },
  { path: '/review', label: 'Kiểm duyệt', icon: ShieldCheck, roles: ['SUPER_ADMIN', 'CONTENT_ADMIN', 'REVIEWER'] },
  { path: '/topics', label: 'Ch? d?', icon: BookOpen, roles: ['SUPER_ADMIN', 'CONTENT_ADMIN'] },
  { path: '/articles', label: 'B�i vi?t', icon: FileText, roles: ['SUPER_ADMIN', 'CONTENT_ADMIN'] },
  { path: '/users', label: 'Người dùng', icon: Users, roles: ['SUPER_ADMIN'] },
  { path: '/community', label: 'Cộng đồng', icon: Heart, roles: ['SUPER_ADMIN'] },
  { path: '/reports', label: 'Báo cáo', icon: Archive, roles: ['SUPER_ADMIN'] },
]

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function Sidebar({ currentPath }: { currentPath: string }) {
  const navigate = useNavigate()
  const { hasRole } = useAuth()

  const visibleNav = nav.filter(item => !item.roles || hasRole(...item.roles))

  return (
    <aside className="sidebar">
      <div className="brand">
        Mogu<span>ADMIN</span>
      </div>
      <nav>
        {visibleNav.map(({ path, label, icon: Icon }) => (
          <button
            key={path}
            className={currentPath.startsWith(path) ? 'nav-item active' : 'nav-item'}
            onClick={() => navigate(path)}
          >
            <Icon size={21} />
            {label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <CheckCircle2 size={18} />
        Hệ thống ổn định
        <i />
        <small>Phiên bản 1.0.0</small>
      </div>
    </aside>
  )
}

// ─── Header ──────────────────────────────────────────────────────────────────

function Header() {
  const { user, roles, signOut } = useAuth()
  const displayName = user?.displayName ?? 'Admin'
  const initial = displayName[0].toUpperCase()

  const roleLabel = () => {
    if (roles.includes('SUPER_ADMIN')) return 'Super Admin'
    if (roles.includes('CONTENT_ADMIN')) return 'Content Admin'
    if (roles.includes('REVIEWER')) return 'Reviewer'
    return 'Quản trị viên'
  }

  return (
    <header className="topbar">
      <label className="top-search">
        <Search size={19} />
        <Input placeholder="Tìm kiếm món ăn, nguồn, người dùng..." />
        <kbd>⌘ K</kbd>
      </label>
      <div className="top-actions">
        <button className="icon-button">
          <Bell size={22} />
        </button>
        <span className="header-line" />
        <div className="admin-avatar">{initial}</div>
        <div>
          <b>{displayName}</b>
          <small>{roleLabel()}</small>
        </div>
        <ChevronDown size={18} />
        <button
          onClick={signOut}
          style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 8 }}
        >
          Đăng xuất
        </button>
      </div>
    </header>
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
