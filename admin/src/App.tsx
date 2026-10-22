import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './providers/AuthProvider'
import { PageSkeleton } from './components/ui/page-skeleton'
import { CommandPaletteModal, Header, ShellProvider, Sidebar } from './components/layout'
import { GlobalJobProgressTray } from './components/ingest'
import './App.css'

// ─── Lazy pages ───────────────────────────────────────────────────────────────

const LoginPage = lazy(() => import('./pages/LoginPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const FoodsPage = lazy(() => import('./pages/FoodsPage'))
const CreateDishPage = lazy(() => import('./pages/CreateDishPage'))
const IngestPage = lazy(() => import('./pages/IngestPage'))
const ReviewPage = lazy(() => import('./pages/ReviewPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'))
const CommunityPage = lazy(() => import('./pages/CommunityPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const FoodDataPage = lazy(() => import('./pages/FoodDataPage'))
const TopicsPage = lazy(() => import('./pages/TopicsPage'))
const ArticlesPage = lazy(() => import('./pages/ArticlesPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const PlacesPage = lazy(() => import('./pages/PlacesPage'))
const FoodScanReportsPage = lazy(() => import('./pages/FoodScanReportsPage'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

// ─── Loading screens ──────────────────────────────────────────────────────────

function BootScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <img src="/noan-mark.png" alt="" width={44} height={44} className="h-11 w-11 animate-pulse rounded-xl" />
        <p className="text-sm font-medium text-muted-foreground">Đang tải NOAN Studio…</p>
      </div>
    </div>
  )
}

function PageFallback() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageSkeleton rows={6} />
    </div>
  )
}

// ─── Protected shell (rendered once, pages swap inside <Outlet />) ───────────

function ProtectedShell() {
  const { session, loading } = useAuth()

  if (loading) return <BootScreen />
  if (!session) return <Navigate to="/login" replace />

  return (
    <ShellProvider>
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="min-w-0 flex-1 pb-12">
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
        <CommandPaletteModal />
        <GlobalJobProgressTray />
      </div>
    </ShellProvider>
  )
}

function PublicRoute() {
  const { session, loading } = useAuth()
  if (loading) return <BootScreen />
  if (session) return <Navigate to="/dashboard" replace />
  return <LoginPage />
}

// ─── Routes ───────────────────────────────────────────────────────────────────

function AppRoutes() {
  return (
    <Suspense fallback={<BootScreen />}>
      <Routes>
        <Route path="/login" element={<PublicRoute />} />

        <Route element={<ProtectedShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/foods" element={<FoodsPage />} />
          <Route path="/foods/new" element={<CreateDishPage key="dish-new" />} />
          <Route path="/foods/ingest" element={<Navigate to="/ingest" replace />} />
          <Route path="/foods/:id" element={<CreateDishPage key="dish-edit" />} />
          <Route path="/ingest" element={<IngestPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/admin-users" element={<AdminUsersPage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/food-data" element={<FoodDataPage />} />
          <Route path="/ingredients" element={<Navigate to="/food-data?tab=ingredients" replace />} />
          <Route path="/categories" element={<Navigate to="/food-data?tab=categories" replace />} />
          <Route path="/diet-types" element={<Navigate to="/food-data?tab=diet-types" replace />} />
          <Route path="/allergens" element={<Navigate to="/food-data?tab=allergens" replace />} />
          <Route path="/topics" element={<TopicsPage />} />
          <Route path="/articles" element={<ArticlesPage />} />
          <Route path="/places" element={<PlacesPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/food-scan-reports" element={<FoodScanReportsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}

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
