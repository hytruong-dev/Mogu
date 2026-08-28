import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import axios from 'axios'
import api, { clearAdminSession } from '../api/client'

const TOKEN_KEY = 'mogu_admin_token'
const REFRESH_KEY = 'mogu_admin_refresh'
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/v1'

async function doRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_KEY)
  if (!refreshToken) return null
  try {
    const res = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken })
    const payload = res.data?.data ?? res.data
    const newAccess = payload?.session?.accessToken ?? payload?.accessToken
    const newRefresh = payload?.session?.refreshToken ?? payload?.refreshToken
    if (newAccess) {
      localStorage.setItem(TOKEN_KEY, newAccess)
      if (newRefresh) localStorage.setItem(REFRESH_KEY, newRefresh)
      return newAccess
    }
  } catch {
    // refresh thất bại
  }
  return null
}

export type AdminRole = 'SUPER_ADMIN' | 'CONTENT_ADMIN' | 'REVIEWER' | 'USER'
export type SystemRole = AdminRole

interface AdminUser {
  id: string
  displayName: string | null
  accountStatus: string
  onboardingStatus: string
  roles?: AdminRole[]
}

interface AuthContextValue {
  user: AdminUser | null
  token: string | null
  roles: AdminRole[]
  loading: boolean
  isSuperAdmin: boolean
  isReviewer: boolean
  isContentAdmin: boolean
  signOut: () => Promise<void>
  hasRole: (...check: AdminRole[]) => boolean
  // Compat alias cho các hook cũ dùng !!session
  session: { access_token: string } | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [loading, setLoading] = useState(true)
  // token là state (reactive) thay vì đọc từ localStorage một lần
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Lắng nghe thay đổi localStorage từ tab khác hoặc cùng tab
    const handleStorage = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY) setToken(e.newValue)
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  // Auto-refresh token mỗi 50 phút (Supabase expire sau 60 phút)
  useEffect(() => {
    if (!token) return
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)

    refreshTimerRef.current = setInterval(async () => {
      const newToken = await doRefresh()
      if (newToken) {
        setToken(newToken)
      } else {
        // refresh thất bại → logout
        clearAdminSession()
        setUser(null)
        setRoles([])
        setToken(null)
        window.location.href = '/login'
      }
    }, 50 * 60 * 1000) // 50 phút

    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
    }
  }, [token])

  useEffect(() => {
    const currentToken = localStorage.getItem(TOKEN_KEY)

    if (!currentToken) {
      setLoading(false)
      setUser(null)
      setRoles([])
      return
    }

    // Đồng bộ token state nếu chưa khớp (ví dụ sau khi login)
    if (currentToken !== token) {
      setToken(currentToken)
    }

    // /auth/me trả về { id, displayName, roles, ... }
    api.get<AdminUser>('/auth/me')
      .then(res => {
        if (res.data) {
          setUser(res.data)
          setRoles((res.data.roles as AdminRole[]) ?? [])
        } else {
          clearAdminSession()
          setToken(null)
        }
      })
      .catch(() => {
        clearAdminSession()
        setUser(null)
        setToken(null)
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signOut = async () => {
    try {
      await api.post('/auth/logout', { scope: 'current' })
    } catch {
      // ignore
    }
    clearAdminSession()
    setUser(null)
    setRoles([])
    setToken(null)
    window.location.href = '/login'
  }

  const hasRole = (...requiredRoles: AdminRole[]): boolean => {
    if (roles.includes('SUPER_ADMIN')) return true
    return requiredRoles.some(r => roles.includes(r))
  }

  const isSuperAdmin = roles.includes('SUPER_ADMIN')
  const isReviewer = roles.includes('REVIEWER') || isSuperAdmin
  const isContentAdmin = roles.includes('CONTENT_ADMIN') || isSuperAdmin

  return (
    <AuthContext.Provider value={{
      user,
      token,
      roles,
      loading,
      isSuperAdmin,
      isReviewer,
      isContentAdmin,
      signOut,
      hasRole,
      session: token ? { access_token: token } : null,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải được dùng trong AuthProvider')
  return ctx
}
