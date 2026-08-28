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
    { value: created, label: 'Thành công món ăn', icon: Utensils, color: 'text-[#16A34A]', bg: 'bg-[#ECFDF3]' },
    { value: skipped, label: 'Bỏ qua (trùng dữ liệu)', icon: Link2, color: 'text-[#7C3AED]', bg: 'bg-[#F5F3FF]' },
    { value: warnings, label: 'Cảnh báo', icon: AlertTriangle, color: 'text-[#EA580C]', bg: 'bg-[#FFF7ED]' },
    { value: failed, label: 'Lỗi hệ thống', icon: XCircle, color: 'text-[#DC2626]', bg: 'bg-[#FEF2F2]' },
    { value: excluded, label: 'Dòng không nhập', icon: FileText, color: 'text-[#DC2626]', bg: 'bg-[#FEF2F2]' },
  ]
  const tabs: { id: CompleteTab; label: string; badge?: { n: number; cls: string } }[] = [
    { id: 'overview', label: 'Tổng quan' },
    { id: 'warning', label: 'Cảnh báo', badge: warnings ? { n: warnings, cls: 'bg-[#FFEDD5] text-[#C2410C]' } : undefined },
    { id: 'excluded', label: 'Bị loại', badge: excluded ? { n: excluded, cls: 'bg-[#FEE2E2] text-[#B91C1C]' } : undefined },
    { id: 'log', label: 'Nhật ký' },
  ]
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-xl bg-[#ECFDF3] px-4 py-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#22C55E] text-white">
          <Check className="h-6 w-6" strokeWidth={3} />
        </div>
        <div>
          <p className="text-xl font-extrabold text-[#16A34A]">{created} món đã được tạo</p>
          <p className="text-sm text-[#374151]">Dữ liệu được lưu dưới dạng bản nháp và sẵn sàng để kiểm tra.</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2.5">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border border-black/10 px-3 py-3">
            <div className={cn('mb-2 flex h-8 w-8 items-center justify-center rounded-lg', m.bg)}>
              <m.icon className={cn('h-4 w-4', m.color)} />
            </div>
            <p className="text-xl font-extrabold leading-none">{m.value}</p>
            <p className="mt-1 text-[11px] leading-snug text-[#6B7280]">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1 border-b border-black/10">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTab(t.id)}
            className={cn(
              '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-semibold',
              tab === t.id ? 'border-[#22C55E] text-[#166534]' : 'border-transparent text-[#6B7280] hover:text-black',
            )}
          >
            {t.label}
            {t.badge && (
              <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold', t.badge.cls)}>{t.badge.n}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold">Các mục cần chú ý</p>
            <div className="space-y-2">
              {(warnings > 0 || failed > 0) && (
                <div className="flex items-start gap-3 rounded-xl border border-black/10 px-3 py-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#EA580C]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{warnings} cảnh báo · {failed} lỗi</p>
                    <p className="text-xs text-[#6B7280]">Xem chi tiết trong báo cáo CSV.</p>
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
                { icon: Utensils, color: 'text-[#2563EB]', bg: 'bg-[#EFF6FF]', label: 'Món ăn', value: String(created) },
                { icon: Link2, color: 'text-[#7C3AED]', bg: 'bg-[#F5F3FF]', label: 'Bỏ qua (trùng)', value: String(skipped) },
              ].map((c) => (
                <div key={c.label} className="flex items-center justify-between rounded-xl border border-black/10 px-3 py-2.5">
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
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#EFF6FF] px-3 py-2.5 text-[12px] text-[#1D4ED8]">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              Các món đang ở trạng thái bản nháp. Bạn cần xem và xác nhận trước khi gửi kiểm duyệt.
            </div>
          </div>
        </div>
      )}

      {tab === 'warning' && (
        <p className="rounded-xl border border-[#FFEDD5] bg-[#FFF7ED] px-4 py-6 text-sm text-[#9A3412]">
          {warnings} món được nhập kèm cảnh báo. Có thể chỉnh trong bản nháp.
        </p>
      )}
      {tab === 'excluded' && (
        <p className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-6 text-sm text-[#991B1B]">
          {excluded} dòng không nhập vì lỗi bắt buộc hoặc bị bỏ qua theo cấu hình.
        </p>
      )}
      {tab === 'log' && (
        <ul className="space-y-2 rounded-xl border border-black/10 p-4 text-sm">
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
      className="flex w-full items-center gap-3 rounded-xl border border-black/10 px-3 py-2.5 text-left text-sm font-medium hover:bg-black/[0.02]"
    >
      <FileSpreadsheet className="h-4 w-4 text-[#16A34A]" />
      {label}
      <Download className="ml-auto h-4 w-4 text-[#9CA3AF]" />
    </button>
  )
}
