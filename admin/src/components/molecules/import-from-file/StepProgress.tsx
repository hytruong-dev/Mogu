import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Cloud,
  Info,
  Link2,
  Utensils,
  XCircle,
} from 'lucide-react'
import type { ProgressLog, ProgressStep } from './types'
import { GreenSwitch } from './widgets'
import { cn } from '@/lib/utils'

interface Props {
  percent: number
  created: number
  total: number
  eta: string
  steps: ProgressStep[]
  logs: ProgressLog[]
  autoOpen: boolean
  onAutoOpen: (v: boolean) => void
}

export function StepProgress({ percent, created, total, eta, steps, logs, autoOpen, onAutoOpen }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-5xl font-extrabold leading-none text-[#16A34A]">{percent}%</p>
        <p className="mt-1 text-sm font-medium text-black">{created} / {total} món</p>
        <p className="text-xs text-[#6B7280]">Ước tính còn {eta}</p>
        <div className="mt-3">
          <div className="h-2.5 overflow-hidden rounded-full bg-[#E5E7EB]">
            <div className="h-full rounded-full bg-[#22C55E] transition-all duration-300" style={{ width: `${percent}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-[#9CA3AF]">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-2">
        {steps.map((s) => (
          <div key={s.n} className="text-center">
            <div
              className={cn(
                'mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
                s.state === 'done' && 'bg-[#22C55E] text-white',
                s.state === 'running' && 'border-2 border-dashed border-[#22C55E] text-[#16A34A]',
                s.state === 'pending' && 'border border-[#D1D5DB] text-[#9CA3AF]',
              )}
            >
              {s.state === 'done' ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : s.n}
            </div>
            <p className="mt-1.5 text-[11px] font-semibold leading-tight text-black">{s.label}</p>
            <p className={cn(
              'mt-0.5 text-[10px]',
              s.state === 'done' && 'text-[#16A34A]',
              s.state === 'running' && 'text-[#16A34A]',
              s.state === 'pending' && 'text-[#9CA3AF]',
            )}>
              {s.sub}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1.4fr_0.8fr] gap-4">
        <div className="rounded-xl border border-black/10 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#22C55E]" />
            <p className="text-sm font-semibold">Nhật ký hoạt động</p>
            <span className="text-xs font-medium text-[#16A34A]">Đang xử lý</span>
          </div>
          <ul className="space-y-3">
            {logs.map((log) => (
              <li key={log.title} className="flex gap-3">
                <LogIcon status={log.status} />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium">{log.title}</p>
                  {log.detail && <p className="text-xs text-[#6B7280]">{log.detail}</p>}
                  <p className="text-[10px] text-[#9CA3AF]">{log.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2.5">
          <MiniCard icon={Utensils} color="text-[#16A34A]" bg="bg-[#ECFDF3]" value={String(created)} label="món ăn" />
          <MiniCard icon={Link2} color="text-[#7C3AED]" bg="bg-[#F5F3FF]" value="5" label="trùng dữ liệu" />
          <MiniCard icon={AlertTriangle} color="text-[#EA580C]" bg="bg-[#FFF7ED]" value="8" label="món ăn" />
          <MiniCard icon={XCircle} color="text-[#DC2626]" bg="bg-[#FEF2F2]" value="0" label="món ăn" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <GreenSwitch checked={autoOpen} onChange={onAutoOpen} label="Tự động mở kết quả khi hoàn tất" />
        <div className="flex items-center gap-2 rounded-lg bg-[#EFF6FF] px-3 py-2 text-[12px] text-[#1D4ED8]">
          <Info className="h-4 w-4 shrink-0" />
          Bạn có thể đóng cửa sổ, tiến trình vẫn chạy trong nền
        </div>
      </div>
    </div>
  )
}

function LogIcon({ status }: { status: ProgressLog['status'] }) {
  if (status === 'done') return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#22C55E]" />
  if (status === 'running') {
    return <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-dashed border-[#22C55E]" />
  }
  return <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-[#D1D5DB]" />
}

function MiniCard({
  icon: Icon, color, bg, value, label,
}: { icon: typeof Utensils; color: string; bg: string; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-black/10 px-3 py-2.5">
      <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', bg)}>
        <Icon className={cn('h-4 w-4', color)} />
      </div>
      <div>
        <p className="text-lg font-extrabold leading-none">{value}</p>
        <p className="text-xs text-[#6B7280]">{label}</p>
      </div>
    </div>
  )
}

export function CloudIcon() {
  return <Cloud className="h-4 w-4" />
}
