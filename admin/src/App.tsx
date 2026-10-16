import { Suspense, lazy, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './providers/AuthProvider'
import { PageSkeleton } from './components/ui/page-skeleton'
import { Sidebar, Header } from './components/layout'
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-500">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto ring-1 ring-amber-500/30 animate-pulse">
            <span className="font-bold text-sm tracking-tight">NOAN</span>
          </div>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Đang khởi tạo Studio Console...</p>
        </div>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  return (
    <div className="flex min-h-screen bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      <Sidebar currentPath={currentPath} />
      <main className="min-w-0 flex-1 flex flex-col overflow-x-hidden">
        <Header />
        <div className="flex-1 pb-16">{children}</div>
      </main>
      <GlobalJobProgressTray />
    </div>
  )
}

// ─── Public Route ─────────────────────────────────────────────────────────────

function PublicRoute() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <PageSkeleton rows={5} withAvatar className="max-w-md w-full p-8" />
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
        <Route path="/foods/ingest" element={<Navigate to="/ingest" replace />} />
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
