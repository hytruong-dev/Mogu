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
import { Progress } from '../../ui/progress'
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
        <p className="text-5xl font-extrabold leading-none text-emerald-700 dark:text-emerald-400">{percent}%</p>
        <p className="mt-1 text-sm font-medium text-foreground">{created} / {total} món</p>
        <p className="text-xs text-muted-foreground">Ước tính còn {eta}</p>
        <div className="mt-3">
          <Progress value={percent} indicatorClassName="bg-emerald-600" className="h-2.5 bg-muted" />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
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
                s.state === 'done' && 'bg-emerald-600 text-white',
                s.state === 'running' && 'border-2 border-dashed border-emerald-500 text-emerald-700 dark:text-emerald-400',
                s.state === 'pending' && 'border border-input text-muted-foreground',
              )}
            >
              {s.state === 'done' ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : s.n}
            </div>
            <p className="mt-1.5 text-[11px] font-semibold leading-tight text-foreground">{s.label}</p>
            <p className={cn(
              'mt-0.5 text-[10px]',
              s.state === 'done' && 'text-emerald-700 dark:text-emerald-400',
              s.state === 'running' && 'text-emerald-700 dark:text-emerald-400',
              s.state === 'pending' && 'text-muted-foreground',
            )}>
              {s.sub}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[1.4fr_0.8fr] gap-4">
        <div className="rounded-xl border border-border p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
            <p className="text-sm font-semibold">Nhật ký hoạt động</p>
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Đang xử lý</span>
          </div>
          <ul className="space-y-3">
            {logs.map((log) => (
              <li key={log.title} className="flex gap-3">
                <LogIcon status={log.status} />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium">{log.title}</p>
                  {log.detail && <p className="text-xs text-muted-foreground">{log.detail}</p>}
                  <p className="text-[10px] text-muted-foreground">{log.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2.5">
          <MiniCard icon={Utensils} color="text-emerald-700 dark:text-emerald-400" bg="bg-emerald-50 dark:bg-emerald-500/10" value={String(created)} label="món ăn" />
          <MiniCard icon={Link2} color="text-violet-600 dark:text-violet-400" bg="bg-violet-50 dark:bg-violet-500/10" value="5" label="trùng dữ liệu" />
          <MiniCard icon={AlertTriangle} color="text-brand-700 dark:text-brand-400" bg="bg-brand-50 dark:bg-brand-500/10" value="8" label="món ăn" />
          <MiniCard icon={XCircle} color="text-rose-600 dark:text-rose-400" bg="bg-rose-50 dark:bg-rose-500/10" value="0" label="món ăn" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <GreenSwitch checked={autoOpen} onChange={onAutoOpen} label="Tự động mở kết quả khi hoàn tất" />
        <div className="flex items-center gap-2 rounded-lg bg-sky-50 dark:bg-sky-500/10 px-3 py-2 text-[12px] text-sky-700 dark:text-sky-400">
          <Info className="h-4 w-4 shrink-0" />
          Bạn có thể đóng cửa sổ, tiến trình vẫn chạy trong nền
        </div>
      </div>
    </div>
  )
}

function LogIcon({ status }: { status: ProgressLog['status'] }) {
  if (status === 'done') return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
  if (status === 'running') {
    return <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-dashed border-emerald-500" />
  }
  return <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-input" />
}

function MiniCard({
  icon: Icon, color, bg, value, label,
}: { icon: typeof Utensils; color: string; bg: string; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
      <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', bg)}>
        <Icon className={cn('h-4 w-4', color)} />
      </div>
      <div>
        <p className="text-lg font-extrabold leading-none">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

export function CloudIcon() {
  return <Cloud className="h-4 w-4" />
}
