import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Label } from '../components/ui/label'
import { Alert, AlertDescription } from '../components/ui/alert'
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
    <div className="login-page flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="login-card w-full max-w-sm shadow-xl border border-border">
        <CardHeader className="text-center pb-4">
          <div className="brand mb-3 text-xl font-black tracking-tight text-foreground">
            Mogu<span className="text-amber-500 font-extrabold ml-1">ADMIN</span>
          </div>
          <CardTitle className="text-xl font-bold">Đăng nhập</CardTitle>
          <CardDescription className="text-xs">
            Chỉ dành cho quản trị viên hệ thống
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="space-y-1.5 text-left">
              <Label htmlFor="login-username" className="text-xs font-semibold">
                Tên đăng nhập
              </Label>
              <Input
                id="login-username"
                type="text"
                placeholder="superadmin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoCapitalize="none"
                autoCorrect="off"
                className="h-10 text-sm"
              />
            </div>
            <div className="space-y-1.5 text-left">
              <Label htmlFor="login-password" className="text-xs font-semibold">
                Mật khẩu
              </Label>
              <Input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-10 text-sm"
              />
            </div>
            {error && (
              <Alert variant="destructive" className="py-2.5 px-3">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs ml-2">{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={loading} className="w-full mt-2 h-10 font-semibold">
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </Button>
          </form>
          <p className="mt-4 text-[11px] text-muted-foreground text-center">
            Quên mật khẩu? Liên hệ Super Admin để được hỗ trợ.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
