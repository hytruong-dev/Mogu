import { useState } from 'react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import api from '../api/client'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Gọi backend API /auth/login với username + password
      // Lưu ý: client.ts interceptor tự unwrap { success, data, timestamp } → data
      // nên res.data ở đây chính là { session, user, nextStep, mustChangePassword }
      const res = await api.post<{
        session: { accessToken: string; refreshToken: string; expiresIn: number }
        user: { id: string; displayName: string | null; accountStatus: string; onboardingStatus: string }
        mustChangePassword?: boolean
        nextStep?: string
      }>('/auth/login', { username: username.trim().toLowerCase(), password })

      // res.data đã được interceptor unwrap từ { success, data, timestamp } → data
      // nên res.data = { session, user, nextStep, mustChangePassword }
      const { session, mustChangePassword } = res.data

      // Lưu token vào localStorage cho Axios interceptor
      localStorage.setItem('mogu_admin_token', session.accessToken)
      localStorage.setItem('mogu_admin_refresh', session.refreshToken)

      if (mustChangePassword) {
        // TODO: redirect đến màn đổi mật khẩu tạm
        setError('Bạn cần đổi mật khẩu trước khi tiếp tục.')
        setLoading(false)
        return
      }

      // Dùng window.location thay vì navigate để AuthProvider re-mount với token mới
      window.location.href = '/dashboard'
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Đăng nhập thất bại'
      setError(msg)
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand" style={{ marginBottom: 24 }}>
          Mogu<span>ADMIN</span>
        </div>
        <h2 style={{ marginBottom: 6 }}>Đăng nhập</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>
          Chỉ dành cho quản trị viên hệ thống
        </p>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label>
            <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Tên đăng nhập
            </span>
            <Input
              type="text"
              placeholder="superadmin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoCapitalize="none"
              autoCorrect="off"
            />
          </label>
          <label>
            <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Mật khẩu
            </span>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && (
            <div style={{ color: 'var(--red)', fontSize: 13, padding: '8px 12px', background: '#fff1f0', borderRadius: 6 }}>
              {error}
            </div>
          )}
          <Button type="submit" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </Button>
        </form>
        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
          Quên mật khẩu? Liên hệ Super Admin để được hỗ trợ.
        </p>
      </div>
    </div>
  )
}
