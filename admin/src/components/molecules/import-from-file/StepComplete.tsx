import {
  AlertTriangle,
  Check,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  Link2,
  Utensils,
  XCircle,
} from 'lucide-react'
import type { CompleteTab } from './types'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '../../ui/card'
import { Tabs, TabsList, TabsTrigger } from '../../ui/tabs'

interface Props {
  tab: CompleteTab
  onTab: (t: CompleteTab) => void
  created?: number
  skipped?: number
  failed?: number
  warnings?: number
  total?: number
  onDownloadReport?: () => void
}

export function StepComplete({ tab, onTab, created = 0, skipped = 0, failed = 0, warnings = 0, total = 0, onDownloadReport }: Props) {
  const excluded = Math.max(0, (total || 0) - created - skipped)
  const metrics = [
    { value: created, label: 'Thành công món ăn', icon: Utensils, color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    { value: skipped, label: 'Bỏ qua (trùng dữ liệu)', icon: Link2, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-500/10' },
    { value: warnings, label: 'Cảnh báo', icon: AlertTriangle, color: 'text-brand-700 dark:text-brand-400', bg: 'bg-brand-50 dark:bg-brand-500/10' },
    { value: failed, label: 'Lỗi hệ thống', icon: XCircle, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-500/10' },
    { value: excluded, label: 'Dòng không nhập', icon: FileText, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-500/10' },
  ]
  const tabs: { id: CompleteTab; label: string; badge?: { n: number; cls: string } }[] = [
    { id: 'overview', label: 'Tổng quan' },
    { id: 'warning', label: 'Cảnh báo', badge: warnings ? { n: warnings, cls: 'bg-brand-100 dark:bg-brand-500/15 text-brand-700 dark:text-brand-400' } : undefined },
    { id: 'excluded', label: 'Bị loại', badge: excluded ? { n: excluded, cls: 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400' } : undefined },
    { id: 'log', label: 'Nhật ký' },
  ]
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 px-4 py-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white">
          <Check className="h-6 w-6" strokeWidth={3} />
        </div>
        <div>
          <p className="text-xl font-extrabold text-emerald-700 dark:text-emerald-400">{created} món đã được tạo</p>
          <p className="text-sm text-foreground/80">Dữ liệu được lưu dưới dạng bản nháp và sẵn sàng để kiểm tra.</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2.5">
        {metrics.map((m) => (
          <Card key={m.label} className="shadow-xs">
            <CardContent className="p-3">
              <div className={cn('mb-2 flex h-8 w-8 items-center justify-center rounded-lg', m.bg)}>
                <m.icon className={cn('h-4 w-4', m.color)} />
              </div>
              <p className="text-xl font-bold tracking-tight text-foreground leading-none">{m.value}</p>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{m.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={(val) => onTab(val as CompleteTab)}>
        <TabsList className="w-full justify-start h-9 p-1">
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="text-xs gap-1.5">
              <span>{t.label}</span>
              {t.badge && (
                <span className={cn('rounded-full px-1.5 py-0.2 text-[10px] font-bold', t.badge.cls)}>{t.badge.n}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {tab === 'overview' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold">Các mục cần chú ý</p>
            <div className="space-y-2">
              {(warnings > 0 || failed > 0) && (
                <div className="flex items-start gap-3 rounded-xl border border-border px-3 py-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand-700 dark:text-brand-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{warnings} cảnh báo · {failed} lỗi</p>
                    <p className="text-xs text-muted-foreground">Xem chi tiết trong báo cáo CSV.</p>
                  </div>
                </div>
              )}
            </div>
            <p className="mb-2 mt-4 text-sm font-semibold">Tải xuống</p>
            <div className="space-y-2">
              <DownloadRow label="Tải báo cáo kết quả .csv" onClick={onDownloadReport} />
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Tóm tắt dữ liệu đã tạo</p>
            <div className="space-y-2">
              {[
                { icon: Utensils, color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-500/10', label: 'Món ăn', value: String(created) },
                { icon: Link2, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-500/10', label: 'Bỏ qua (trùng)', value: String(skipped) },
              ].map((c) => (
                <div key={c.label} className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm">
                    <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', c.bg)}>
                      <c.icon className={cn('h-4 w-4', c.color)} />
                    </span>
                    {c.label}
                  </span>
                  <b>{c.value}</b>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-sky-50 dark:bg-sky-500/10 px-3 py-2.5 text-[12px] text-sky-700 dark:text-sky-400">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              Các món đang ở trạng thái bản nháp. Bạn cần xem và xác nhận trước khi gửi kiểm duyệt.
            </div>
          </div>
        </div>
      )}

      {tab === 'warning' && (
        <p className="rounded-xl border border-brand-100 dark:border-brand-500/20 bg-brand-50 dark:bg-brand-500/10 px-4 py-6 text-sm text-brand-800 dark:text-brand-300">
          {warnings} món được nhập kèm cảnh báo. Có thể chỉnh trong bản nháp.
        </p>
      )}
      {tab === 'excluded' && (
        <p className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-4 py-6 text-sm text-rose-800 dark:text-rose-300">
          {excluded} dòng không nhập vì lỗi bắt buộc hoặc bị bỏ qua theo cấu hình.
        </p>
      )}
      {tab === 'log' && (
        <ul className="space-y-2 rounded-xl border border-border p-4 text-sm">
          <li>Đã tạo {created} món bản nháp</li>
          <li>Bỏ qua {skipped} dòng trùng</li>
          <li>{failed} lỗi hệ thống</li>
          <li>{warnings} cảnh báo</li>
        </ul>
      )}
    </div>
  )
}

function DownloadRow({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-left text-sm font-medium hover:bg-black/[0.02]"
    >
      <FileSpreadsheet className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
      {label}
      <Download className="ml-auto h-4 w-4 text-muted-foreground" />
    </button>
  )
}
