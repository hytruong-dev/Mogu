import { useState } from 'react'
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import api from '../api/client'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // client.ts interceptor unwraps { success, data } → data
      const res = await api.post<{
        session: { accessToken: string; refreshToken: string; expiresIn: number }
        mustChangePassword?: boolean
      }>('/auth/login', { username: username.trim().toLowerCase(), password })

      const { session, mustChangePassword } = res.data
      localStorage.setItem('mogu_admin_token', session.accessToken)
      localStorage.setItem('mogu_admin_refresh', session.refreshToken)

      if (mustChangePassword) {
        setError('Bạn cần đổi mật khẩu trước khi tiếp tục. Liên hệ Super Admin để được hỗ trợ.')
        setLoading(false)
        return
      }

      // Full reload so AuthProvider re-initialises with the new token
      window.location.href = '/dashboard'
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string }
      setError(e?.response?.data?.message ?? e?.message ?? 'Đăng nhập thất bại')
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1fr_minmax(480px,560px)]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-500 via-brand-500 to-brand-600 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="relative flex items-center gap-3">
          <img src="/noan-mark.png" alt="" width={40} height={40} className="h-10 w-10 rounded-xl ring-2 ring-white/30" />
          <span className="text-lg font-extrabold tracking-tight text-white">NOAN Studio</span>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white">
            Quản lý kho món ăn Việt, gọn gàng trong một nơi.
          </h1>
          <p className="mt-4 text-base text-white/85">
            Biên tập món, kiểm duyệt nội dung cộng đồng và theo dõi người dùng — tất cả trong NOAN Studio.
          </p>
        </div>
        <p className="relative text-sm text-white/70">© {new Date().getFullYear()} NOAN · Mogu</p>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src="/noan-mark.png" alt="" width={40} height={40} className="h-10 w-10 rounded-xl" />
            <span className="text-lg font-extrabold tracking-tight">NOAN Studio</span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-foreground">Đăng nhập</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">Dùng tài khoản quản trị được cấp để tiếp tục.</p>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="login-username" className="text-sm font-medium">
                Tên đăng nhập
              </Label>
              <Input
                id="login-username"
                type="text"
                placeholder="vd: noan.content"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-password" className="text-sm font-medium">
                Mật khẩu
              </Label>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-11 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" disabled={loading} className="h-11 w-full text-sm">
              {loading && <Loader2 className="animate-spin" />}
              {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Quên mật khẩu? Liên hệ Super Admin để được cấp lại.
          </p>
        </div>
      </div>
    </div>
  )
}
