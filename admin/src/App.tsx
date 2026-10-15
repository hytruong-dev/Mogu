import { Suspense, lazy, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './providers/AuthProvider'
import { PageSkeleton } from './components/ui/page-skeleton'
import { Sidebar, Header } from './components/layout'
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
const FoodScanReportsPage = lazy(() => import('./pages/FoodScanReportsPage'))

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

// ─── Protected Layout ─────────────────────────────────────────────────────────

function ProtectedLayout({ children, currentPath }: { children: ReactNode; currentPath: string }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-500">
        <div className="text-center space-y-2">
          <div className="text-2xl animate-spin">⏳</div>
          <p className="text-sm font-medium">Đang kiểm tra phiên đăng nhập...</p>
        </div>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  return (
    <div className="app-shell">
      <Sidebar currentPath={currentPath} />
      <main className="min-w-0 flex-1 flex flex-col">
        <Header />
        <div className="content flex-1">{children}</div>
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
        <div className="min-h-[60vh] p-6">
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
        <Route path="/food-scan-reports" element={<ProtectedLayout currentPath="/food-scan-reports"><FoodScanReportsPage /></ProtectedLayout>} />

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
