import axios from 'axios'

const TOKEN_KEY = 'mogu_admin_token'
const REFRESH_KEY = 'mogu_admin_refresh'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3001/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Tự động đính JWT vào mọi request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// Auto-unwrap TransformInterceptor: { success, data, timestamp } → data
api.interceptors.response.use(
  (res) => {
    const body = res.data
    if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
      res.data = body.data
    }
    return res
  },
  async (error) => {
    const original = error.config

    // 401 → thử refresh token
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refreshToken = localStorage.getItem(REFRESH_KEY)
      if (refreshToken) {
        try {
          const refreshRes = await axios.post(
            `${import.meta.env.VITE_API_URL ?? 'http://localhost:3001/v1'}/auth/refresh`,
            { refreshToken },
          )
          // Backend trả { success, data: { session, user } } qua TransformInterceptor
          const payload = refreshRes.data?.data ?? refreshRes.data
          const newToken = payload?.session?.accessToken ?? payload?.accessToken
          const newRefresh = payload?.session?.refreshToken ?? payload?.refreshToken
          if (newToken) {
            localStorage.setItem(TOKEN_KEY, newToken)
            if (newRefresh) localStorage.setItem(REFRESH_KEY, newRefresh)
            original.headers.Authorization = `Bearer ${newToken}`
            return api(original)
          }
        } catch {
          // refresh thất bại → về login
          localStorage.removeItem(TOKEN_KEY)
          localStorage.removeItem(REFRESH_KEY)
          window.location.href = '/login'
        }
      } else {
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  },
)

export default api

// Helper để xóa session (dùng khi logout)
export function clearAdminSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

// Helper kiểm tra có token không
export function hasAdminToken(): boolean {
  return !!localStorage.getItem(TOKEN_KEY)
}
