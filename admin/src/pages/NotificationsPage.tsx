import { useCallback, useEffect, useState } from 'react'
import {
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Radio,
  RefreshCw,
  Send,
  Smartphone,
  Sparkles,
  User,
  Users,
} from 'lucide-react'
import {
  adminNotificationsApi,
  type BroadcastHistoryItem,
  type BroadcastNotificationDto,
  type BroadcastType,
} from '../api/notifications'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { TableSkeleton } from '../components/ui/page-skeleton'
import { Spinner } from '../components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import { Textarea } from '../components/ui/textarea'

const QUICK_LINKS = [
  { label: 'Trang chủ', link: 'mogu://home' },
  { label: 'Kế hoạch tuần', link: 'mogu://weekly-plans' },
  { label: 'Nhật ký sức khỏe', link: 'mogu://health' },
  { label: 'Hộp thư thông báo', link: 'mogu://notifications' },
]

export default function NotificationsPage() {
  const [form, setForm] = useState<BroadcastNotificationDto>({
    title: '',
    body: '',
    type: 'SYSTEM',
    scope: 'ALL',
    targetUser: '',
    deepLink: '',
  })
  const [sending, setSending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [successResult, setSuccessResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // History state
  const [history, setHistory] = useState<BroadcastHistoryItem[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [page, setPage] = useState(1)
  const limit = 10

  const loadHistory = useCallback(async (p = 1) => {
    setHistoryLoading(true)
    try {
      const res = await adminNotificationsApi.history({
        limit,
        offset: (p - 1) * limit,
      })
      setHistory(res.items ?? [])
      setHistoryTotal(res.total ?? 0)
      setPage(p)
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadHistory(1)
  }, [loadHistory])

  const handleSend = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      setError('Vui lòng nhập đầy đủ tiêu đề và nội dung thông báo.')
      return
    }
    if (form.scope === 'SPECIFIC_USER' && !form.targetUser?.trim()) {
      setError('Vui lòng nhập username hoặc userId người nhận.')
      return
    }

    setSending(true)
    setError(null)
    setSuccessResult(null)

    try {
      const res = await adminNotificationsApi.broadcast({
        title: form.title.trim(),
        body: form.body.trim(),
        type: form.type,
        scope: form.scope,
        targetUser: form.scope === 'SPECIFIC_USER' ? form.targetUser?.trim() : undefined,
        deepLink: form.deepLink?.trim() || undefined,
      })

      setConfirmOpen(false)
      setSuccessResult(
        `Đã phát thông báo thành công tới ${res.totalRecipients} người dùng (${res.pushSentCount} push notification đã gửi qua Expo).`,
      )
      setForm({
        title: '',
        body: '',
        type: 'SYSTEM',
        scope: 'ALL',
        targetUser: '',
        deepLink: '',
      })
      void loadHistory(1)
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e.message ?? 'Lỗi khi gửi thông báo broadcast.')
    } finally {
      setSending(false)
    }
  }

  const totalPages = Math.ceil(historyTotal / limit)

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Bell className="text-primary" size={24} />
            Phát thông báo hệ thống (Broadcast)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gửi thông báo in-app và đẩy Expo Push Notifications trực tiếp đến thiết bị di động người dùng.
          </p>
        </div>
      </div>

      {/* Alert banner */}
      {error && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-500 font-bold ml-2">
            ×
          </button>
        </div>
      )}
      {successResult && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={15} />
            {successResult}
          </span>
          <button onClick={() => setSuccessResult(null)} className="text-emerald-500 font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {/* Grid: Form compose (Left) & Preview device (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Compose Form */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Send size={16} className="text-primary" />
              Soạn thảo thông báo
            </CardTitle>
            <CardDescription className="text-xs">
              Điền nội dung và thiết lập phạm vi người nhận thông báo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Scope selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Phạm vi người nhận</Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, scope: 'ALL' })}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                    form.scope === 'ALL'
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted/40'
                  }`}
                >
                  <Users size={14} />
                  Toàn bộ người dùng (Broadcast All)
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, scope: 'SPECIFIC_USER' })}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                    form.scope === 'SPECIFIC_USER'
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted/40'
                  }`}
                >
                  <User size={14} />
                  Người dùng cụ thể
                </button>
              </div>
            </div>

            {/* Target user input if SPECIFIC_USER */}
            {form.scope === 'SPECIFIC_USER' && (
              <div className="space-y-1.5 bg-muted/30 p-3 rounded-lg border border-border">
                <Label htmlFor="target-user" className="text-xs font-semibold">
                  Username hoặc User ID <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="target-user"
                  placeholder="VD: quanghy2 hoặc uuid..."
                  value={form.targetUser}
                  onChange={(e) => setForm({ ...form, targetUser: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
            )}

            {/* Notification Type */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Phân loại thông báo</Label>
              <div className="flex items-center gap-2">
                {(['SYSTEM', 'PROMO', 'REMINDER'] as BroadcastType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, type: t })}
                    className={`px-3 py-1 text-xs font-medium rounded-md border transition-colors ${
                      form.type === t
                        ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                        : 'bg-card text-muted-foreground border-border hover:text-foreground'
                    }`}
                  >
                    {t === 'SYSTEM' ? 'Hệ thống' : t === 'PROMO' ? 'Khuyến mãi / Tin tức' : 'Nhắc nhở'}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="notif-title" className="text-xs font-semibold">
                Tiêu đề thông báo <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="notif-title"
                placeholder="VD: Cập nhật tính năng Mogu v2.0 hoặc Lời nhắc bữa trưa"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="h-9 text-xs"
                maxLength={100}
              />
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <Label htmlFor="notif-body" className="text-xs font-semibold">
                Nội dung chi tiết <span className="text-rose-500">*</span>
              </Label>
              <Textarea
                id="notif-body"
                placeholder="Nhập thông điệp gửi tới người dùng..."
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={3}
                className="text-xs"
                maxLength={400}
              />
            </div>

            {/* Deep Link */}
            <div className="space-y-1.5">
              <Label htmlFor="notif-link" className="text-xs font-semibold">
                Deep link ứng dụng (Tùy chọn)
              </Label>
              <Input
                id="notif-link"
                placeholder="VD: mogu://weekly-plans"
                value={form.deepLink}
                onChange={(e) => setForm({ ...form, deepLink: e.target.value })}
                className="h-9 text-xs font-mono"
              />
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[11px] text-muted-foreground">Gợi ý nhanh:</span>
                {QUICK_LINKS.map((ql) => (
                  <button
                    key={ql.link}
                    type="button"
                    onClick={() => setForm({ ...form, deepLink: ql.link })}
                    className="text-[10px] bg-muted px-2 py-0.5 rounded border border-border/80 hover:bg-muted/80 text-muted-foreground transition-colors"
                  >
                    {ql.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={!form.title.trim() || !form.body.trim() || sending}
                className="gap-2 text-xs font-semibold"
              >
                <Send size={14} />
                Gửi thông báo ngay
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Live Notification Preview (Right) */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Smartphone size={16} className="text-primary" />
              Xem trước hiển thị (Mockup)
            </CardTitle>
            <CardDescription className="text-xs">
              Mô phỏng thông báo push trên thanh trạng thái điện thoại
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center items-center p-4 bg-muted/20">
            {/* Phone Banner Mockup */}
            <div className="w-full max-w-xs bg-card/95 backdrop-blur rounded-2xl p-3.5 shadow-lg border border-border/80 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center text-[9px] text-primary-foreground font-black">
                    M
                  </div>
                  MOGU
                </div>
                <span>vừa xong</span>
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">
                  {form.title.trim() || 'Tiêu đề thông báo mẫu'}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-3 leading-relaxed">
                  {form.body.trim() || 'Nội dung thông báo sẽ xuất hiện ở đây khi người dùng nhận được thông báo từ ban quản trị Mogu.'}
                </p>
              </div>
              {form.deepLink && (
                <div className="pt-1 border-t border-border/60 text-[10px] text-primary font-mono truncate">
                  Liên kết: {form.deepLink}
                </div>
              )}
            </div>

            <div className="mt-4 text-[11px] text-muted-foreground text-center max-w-xs">
              Khi gửi, người dùng sẽ nhận được một bản ghi trong hộp thư In-app và thông báo đẩy (Push) nếu thiết bị đã bật quyền thông báo.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Broadcast History Table */}
      <Card>
        <CardHeader className="p-5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Radio size={16} className="text-primary" />
                Lịch sử phát thông báo
              </CardTitle>
              <CardDescription className="text-xs">
                Tổng cộng {historyTotal} lượt phát thông báo được ghi lại
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void loadHistory(page)}
              className="h-8 text-xs gap-1"
            >
              <RefreshCw size={12} className={historyLoading ? 'animate-spin' : ''} />
              Làm mới
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {historyLoading ? (
            <div className="p-5">
              <TableSkeleton rows={5} cols={5} />
            </div>
          ) : history.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground">
              Chưa có lịch sử phát thông báo nào.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-36">Thời gian</TableHead>
                  <TableHead>Tiêu đề & Nội dung</TableHead>
                  <TableHead className="w-28 text-center">Phân loại</TableHead>
                  <TableHead className="w-36 text-center">Phạm vi</TableHead>
                  <TableHead className="w-32 text-center">Người gửi</TableHead>
                  <TableHead className="w-32 text-right">Kết quả đẩy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(item.occurredAt).toLocaleString('vi-VN')}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5 max-w-md">
                        <div className="font-semibold text-xs text-foreground truncate">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-muted-foreground line-clamp-1">
                          {item.body}
                        </div>
                        {item.deepLink && (
                          <div className="text-[10px] text-primary font-mono truncate">
                            {item.deepLink}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={item.type === 'PROMO' ? 'warning' : 'secondary'}
                        className="text-[10px]"
                      >
                        {item.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {item.scope === 'ALL' ? (
                        <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700 border-sky-200">
                          Tất cả ({item.totalRecipients})
                        </Badge>
                      ) : (
                        <span className="text-xs font-mono text-muted-foreground" title={item.targetUser ?? ''}>
                          {item.targetUser ? item.targetUser.slice(0, 14) : '1 user'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {item.actor?.displayName ?? 'Admin'}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      <div className="space-y-0.5">
                        <span className="text-emerald-600 font-semibold">
                          +{item.pushSentCount} push
                        </span>
                        {item.pushFailedCount > 0 && (
                          <div className="text-[10px] text-rose-500">
                            {item.pushFailedCount} lỗi
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border">
              <div className="text-xs text-muted-foreground">
                Trang {page} / {totalPages}
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1 || historyLoading}
                  onClick={() => void loadHistory(page - 1)}
                  className="h-8 text-xs gap-1"
                >
                  <ChevronLeft size={13} />
                  Trước
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages || historyLoading}
                  onClick={() => void loadHistory(page + 1)}
                  className="h-8 text-xs gap-1"
                >
                  Sau
                  <ChevronRight size={13} />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Modal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Sparkles size={18} />
              Xác nhận phát thông báo
            </DialogTitle>
            <DialogDescription>
              Hành động này sẽ gửi thông báo đến người dùng ngay lập tức và không thể thu hồi.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 bg-muted/40 rounded-lg space-y-1.5">
              <div>
                <span className="text-muted-foreground">Tiêu đề: </span>
                <strong className="text-foreground">{form.title}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Phạm vi: </span>
                <strong className="text-foreground">
                  {form.scope === 'ALL'
                    ? 'Tất cả người dùng trên hệ thống'
                    : `Chỉ gửi cho: ${form.targetUser}`}
                </strong>
              </div>
              <div>
                <span className="text-muted-foreground">Loại: </span>
                <Badge variant="secondary" className="text-[10px] ml-1">
                  {form.type}
                </Badge>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={sending}>
              Hủy bỏ
            </Button>
            <Button onClick={handleSend} disabled={sending} className="gap-2 font-semibold">
              {sending ? <Spinner size="sm" /> : <Send size={14} />}
              {sending ? 'Đang gửi...' : 'Xác nhận phát'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
